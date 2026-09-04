/**
 * @fileoverview Idempotent Fetch-Enrich-Restore (FER) Migration Protocol for Deal Intelligence (Phase 6).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills Rule 5 (FER Protocol & Seeding) and Rule 9 (Batch Resilience):
 * 1. Fetch: Scans existing workspace collections for governance, signals, and briefs.
 * 2. Enrich: Synthesizes canonical governance policy, 4 realistic buyer signals, 3 deal health cards,
 *    2 stakeholder maps, and 2 meeting briefs.
 * 3. Restore: Idempotently upserts documents with batch operations capped at <= 25 writes to avoid overload.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Never overwrite customized enterprise governance policies if already modified by admins.
 *
 * TESTABILITY POINTER:
 * Designed for idempotent invocation via `executeDealIntelligenceMigrationAction` or Backoffice.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  DealIntelligenceGovernance,
  BuyerSignal,
  StakeholderMap,
  MeetingBrief,
} from './types';
import {
  DEFAULT_DEAL_INTELLIGENCE_GOVERNANCE,
  calculateDealHealthScore,
} from './deal-intelligence-engine';

export interface DealIntelligenceMigrationResult {
  success: boolean;
  workspaceId: string;
  governanceProvisioned: boolean;
  signalsCreated: number;
  dealHealthCardsCreated: number;
  stakeholderMapsCreated: number;
  meetingBriefsCreated: number;
  error?: string;
}

export async function executeDealIntelligenceMigration(
  workspaceId: string,
  organizationId: string,
  actorId = 'system',
  actorName = 'System Migration Protocol'
): Promise<DealIntelligenceMigrationResult> {
  try {
    if (!workspaceId || !organizationId) {
      return {
        success: false,
        workspaceId,
        governanceProvisioned: false,
        signalsCreated: 0,
        dealHealthCardsCreated: 0,
        stakeholderMapsCreated: 0,
        meetingBriefsCreated: 0,
        error: 'Missing required workspace or organization identifier.',
      };
    }

    const now = new Date().toISOString();
    const nowMs = Date.now();

    // -------------------------------------------------------------
    // Step 1: Provision / Verify Governance Document
    // -------------------------------------------------------------
    const govRef = adminDb.collection('dealIntelligenceGovernance').doc(workspaceId);
    const govSnap = await govRef.get();
    let governanceProvisioned = false;

    if (!govSnap.exists) {
      const canonicalGov: DealIntelligenceGovernance = {
        ...DEFAULT_DEAL_INTELLIGENCE_GOVERNANCE,
        workspaceId,
        organizationId,
        updatedAt: now,
        updatedBy: `${actorName} (${actorId})`,
      };
      await govRef.set(canonicalGov);
      governanceProvisioned = true;
    }

    // -------------------------------------------------------------
    // Step 2: Provision Realistic Sample Buyer Signals
    // -------------------------------------------------------------
    const signalsRef = adminDb.collection('buyerSignals');
    const existingSignals = await signalsRef
      .where('workspaceId', '==', workspaceId)
      .limit(5)
      .get();

    let signalsCreated = 0;
    if (existingSignals.empty) {
      const sampleSignals: BuyerSignal[] = [
        {
          id: `sig_${workspaceId}_1`,
          workspaceId,
          organizationId,
          entityId: `deal_${workspaceId}_1`,
          entityType: 'deal',
          entityName: 'Acme Corp — Enterprise Cloud Expansion',
          signalType: 'proposal_open',
          intentLevel: 'high',
          sentiment: 'positive',
          confidenceScore: 94,
          source: 'proposal',
          title: 'Executive Proposal Reviewed & Downloaded',
          description: 'CFO Kofi Mensah opened the Master Services Agreement proposal and spent 8m 45s on the pricing table.',
          actionRequired: true,
          suggestedAction: {
            actionType: 'call',
            title: 'Call CFO Kofi Mensah to address commercial questions',
            priority: 'urgent',
          },
          status: 'active',
          createdAt: new Date(nowMs - 2 * 3600000).toISOString(), // 2 hours ago
          updatedAt: new Date(nowMs - 2 * 3600000).toISOString(),
        },
        {
          id: `sig_${workspaceId}_2`,
          workspaceId,
          organizationId,
          entityId: `deal_${workspaceId}_2`,
          entityType: 'deal',
          entityName: 'Apex Banking — Core Automation Upgrade',
          signalType: 'intent_spike',
          intentLevel: 'high',
          sentiment: 'positive',
          confidenceScore: 89,
          source: 'web',
          title: 'High-Velocity Pricing & Security Visits',
          description: '4 distinct IP addresses from Apex Banking visited the SOC2 Compliance and Enterprise Tier pricing pages today.',
          actionRequired: true,
          suggestedAction: {
            actionType: 'email',
            title: 'Send Enterprise Security Whitepaper & Schedule Review',
            priority: 'high',
          },
          status: 'active',
          createdAt: new Date(nowMs - 5 * 3600000).toISOString(),
          updatedAt: new Date(nowMs - 5 * 3600000).toISOString(),
        },
        {
          id: `sig_${workspaceId}_3`,
          workspaceId,
          organizationId,
          entityId: `deal_${workspaceId}_3`,
          entityType: 'deal',
          entityName: 'GoldCoast Retail — Point-of-Sale Integration',
          signalType: 'competitor_mention',
          intentLevel: 'medium',
          sentiment: 'neutral',
          confidenceScore: 78,
          source: 'meeting',
          title: 'Competitor Mentioned in Call Takeaways',
          description: 'Buyer mentioned active benchmark evaluation against Legacy POS Provider.',
          actionRequired: true,
          suggestedAction: {
            actionType: 'task',
            title: 'Share Competitive Migration ROI Matrix with Champion',
            priority: 'high',
          },
          status: 'active',
          createdAt: new Date(nowMs - 24 * 3600000).toISOString(),
          updatedAt: new Date(nowMs - 24 * 3600000).toISOString(),
        },
        {
          id: `sig_${workspaceId}_4`,
          workspaceId,
          organizationId,
          entityId: `acc_${workspaceId}_4`,
          entityType: 'account',
          entityName: 'Zenith Logistics Global',
          signalType: 'content_download',
          intentLevel: 'low',
          sentiment: 'positive',
          confidenceScore: 65,
          source: 'web',
          title: 'Fleet Operations Case Study Downloaded',
          description: 'VP Operations downloaded the West Africa Logistics Case Study.',
          actionRequired: false,
          status: 'active',
          createdAt: new Date(nowMs - 48 * 3600000).toISOString(),
          updatedAt: new Date(nowMs - 48 * 3600000).toISOString(),
        },
      ];

      const batch = adminDb.batch();
      for (const sig of sampleSignals) {
        batch.set(signalsRef.doc(sig.id), sig);
      }
      await batch.commit();
      signalsCreated = sampleSignals.length;
    }

    // -------------------------------------------------------------
    // Step 3: Provision Sample Stakeholder Maps & Deal Health Cards
    // -------------------------------------------------------------
    const stakeMapsRef = adminDb.collection('stakeholderMaps');
    const existingMaps = await stakeMapsRef
      .where('workspaceId', '==', workspaceId)
      .limit(5)
      .get();

    let stakeholderMapsCreated = 0;
    let dealHealthCardsCreated = 0;

    if (existingMaps.empty) {
      // Map 1: Healthy Multi-Threaded Deal
      const map1: StakeholderMap = {
        id: `map_${workspaceId}_1`,
        dealId: `deal_${workspaceId}_1`,
        dealName: 'Acme Corp — Enterprise Cloud Expansion',
        workspaceId,
        organizationId,
        multiThreadingScore: 90,
        isSingleThreaded: false,
        stakeholders: [
          {
            contactId: `cnt_${workspaceId}_1`,
            name: 'Kofi Mensah',
            title: 'Chief Financial Officer',
            email: 'kofi.mensah@acmecorp.com',
            phone: '+233 24 456 7890',
            role: 'economic_buyer',
            sentiment: 'supporter',
            engagement: 'active',
            isPrimaryContact: true,
            notes: 'Strong alignment on 3-year ROI. Focused on cash flow schedule.',
            lastInteractedAt: new Date(nowMs - 2 * 3600000).toISOString(),
          },
          {
            contactId: `cnt_${workspaceId}_2`,
            name: 'Ama Serwaa',
            title: 'VP of Technology & Infra',
            email: 'ama.serwaa@acmecorp.com',
            phone: '+233 20 123 4567',
            role: 'champion',
            sentiment: 'champion',
            engagement: 'active',
            isPrimaryContact: false,
            notes: 'Internal champion driving cloud modernization mandate.',
            lastInteractedAt: new Date(nowMs - 24 * 3600000).toISOString(),
          },
          {
            contactId: `cnt_${workspaceId}_3`,
            name: 'David Osei',
            title: 'Lead Cloud Architect',
            email: 'david.osei@acmecorp.com',
            role: 'technical_gatekeeper',
            sentiment: 'neutral',
            engagement: 'active',
            isPrimaryContact: false,
            notes: 'Reviewed architecture blueprints; satisfied with failover SLA.',
            lastInteractedAt: new Date(nowMs - 48 * 3600000).toISOString(),
          },
        ],
        missingCrucialRoles: [],
        updatedAt: now,
      };

      // Map 2: Single-Threaded At-Risk Deal
      const map2: StakeholderMap = {
        id: `map_${workspaceId}_2`,
        dealId: `deal_${workspaceId}_2`,
        dealName: 'Apex Banking — Core Automation Upgrade',
        workspaceId,
        organizationId,
        multiThreadingScore: 35,
        isSingleThreaded: true,
        stakeholders: [
          {
            contactId: `cnt_${workspaceId}_4`,
            name: 'Robert Adjei',
            title: 'IT Project Manager',
            email: 'robert.adjei@apexbank.com',
            phone: '+233 27 890 1234',
            role: 'evaluator',
            sentiment: 'neutral',
            engagement: 'passive',
            isPrimaryContact: true,
            notes: 'Sole point of contact. Has not introduced the Banking Operations Director.',
            lastInteractedAt: new Date(nowMs - 12 * 86400000).toISOString(),
          },
        ],
        missingCrucialRoles: ['economic_buyer', 'champion'],
        updatedAt: now,
      };

      const batchMaps = adminDb.batch();
      batchMaps.set(stakeMapsRef.doc(map1.id), map1);
      batchMaps.set(stakeMapsRef.doc(map2.id), map2);
      await batchMaps.commit();
      stakeholderMapsCreated = 2;

      // Compute and save Deal Health Scorecards
      const card1 = calculateDealHealthScore({
        deal: {
          id: `deal_${workspaceId}_1`,
          name: 'Acme Corp — Enterprise Cloud Expansion',
          value: 65000,
          stageId: 'proposal',
          stageName: 'Proposal & Pricing',
          ownerId: actorId,
          ownerName: actorName,
          createdAt: new Date(nowMs - 20 * 86400000).toISOString(),
          updatedAt: now,
          daysInStage: 4,
          slipCount: 0,
        },
        stakeholders: map1.stakeholders,
        interactions: [
          { timestamp: new Date(nowMs - 2 * 3600000).toISOString(), actorType: 'buyer' },
          { timestamp: new Date(nowMs - 24 * 3600000).toISOString(), actorType: 'human' },
          { timestamp: new Date(nowMs - 72 * 3600000).toISOString(), actorType: 'buyer' },
        ],
        calls: [{ overallScore: 4.5, sentiment: 'positive', unresolvedObjections: [] }],
        referenceTimeMs: nowMs,
      });

      const card2 = calculateDealHealthScore({
        deal: {
          id: `deal_${workspaceId}_2`,
          name: 'Apex Banking — Core Automation Upgrade',
          value: 38000,
          stageId: 'solution_design',
          stageName: 'Solution Design',
          ownerId: actorId,
          ownerName: actorName,
          createdAt: new Date(nowMs - 45 * 86400000).toISOString(),
          updatedAt: now,
          daysInStage: 19,
          slipCount: 2,
        },
        stakeholders: map2.stakeholders,
        interactions: [
          { timestamp: new Date(nowMs - 12 * 86400000).toISOString(), actorType: 'human' },
        ],
        calls: [{ overallScore: 2.2, sentiment: 'negative', unresolvedObjections: ['Pricing budget constraint'] }],
        referenceTimeMs: nowMs,
      });

      const healthCardsRef = adminDb.collection('dealHealthScorecards');
      const batchCards = adminDb.batch();
      batchCards.set(healthCardsRef.doc(card1.id), card1);
      batchCards.set(healthCardsRef.doc(card2.id), card2);
      await batchCards.commit();
      dealHealthCardsCreated = 2;
    }

    // -------------------------------------------------------------
    // Step 4: Provision Sample Meeting Briefs
    // -------------------------------------------------------------
    const briefsRef = adminDb.collection('meetingBriefs');
    const existingBriefs = await briefsRef
      .where('workspaceId', '==', workspaceId)
      .limit(5)
      .get();

    let meetingBriefsCreated = 0;
    if (existingBriefs.empty) {
      const sampleBriefs: MeetingBrief[] = [
        {
          id: `brief_${workspaceId}_1`,
          meetingId: `meet_${workspaceId}_1`,
          title: 'Acme Corp — Commercial Term Sheet & POC Sign-off',
          scheduledAt: new Date(nowMs + 2 * 3600000).toISOString(), // in 2 hours
          durationMinutes: 45,
          dealId: `deal_${workspaceId}_1`,
          dealName: 'Acme Corp — Enterprise Cloud Expansion',
          accountId: `acc_${workspaceId}_1`,
          accountName: 'Acme Corporation',
          workspaceId,
          organizationId,
          hostRepId: actorId,
          hostRepName: actorName,
          attendees: [
            {
              contactId: `cnt_${workspaceId}_1`,
              name: 'Kofi Mensah',
              title: 'CFO',
              role: 'economic_buyer',
              sentiment: 'supporter',
              recentNotes: 'Reviewed proposal table. Wants confirmation of payment schedule.',
            },
            {
              contactId: `cnt_${workspaceId}_2`,
              name: 'Ama Serwaa',
              title: 'VP of Tech',
              role: 'champion',
              sentiment: 'champion',
              recentNotes: 'Championing internal transition from on-premise infrastructure.',
            },
          ],
          previousCallTakeaways: [
            'CFO expressed concern about unexpected bandwidth overage charges in Call #2.',
            'Technical architect confirmed security certification requirements are met.',
          ],
          strategicTalkTrack: [
            'Anchor value on projected 34% reduction in operating server expenses.',
            'Confirm fixed-tier bandwidth pricing to alleviate overage cost uncertainty.',
            'Gain verbal sign-off on POC rollout commencing October 1st.',
          ],
          recommendedQuestions: [
            'Kofi, what is the internal approval timeline once the payment terms are locked?',
            'Ama, are there any dependent teams that need notification before deployment begins?',
          ],
          desiredOutcomeChecklist: [
            { id: 'chk_1', label: 'Agree on net-30 milestone payment schedule', completed: false },
            { id: 'chk_2', label: 'Confirm security compliance sign-off date', completed: false },
            { id: 'chk_3', label: 'Schedule implementation kickoff call', completed: false },
          ],
          status: 'upcoming',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `brief_${workspaceId}_2`,
          meetingId: `meet_${workspaceId}_2`,
          title: 'Apex Banking — Executive Sponsor Alignment',
          scheduledAt: new Date(nowMs + 24 * 3600000).toISOString(), // tomorrow
          durationMinutes: 30,
          dealId: `deal_${workspaceId}_2`,
          dealName: 'Apex Banking — Core Automation Upgrade',
          accountId: `acc_${workspaceId}_2`,
          accountName: 'Apex Banking Group',
          workspaceId,
          organizationId,
          hostRepId: actorId,
          hostRepName: actorName,
          attendees: [
            {
              contactId: `cnt_${workspaceId}_4`,
              name: 'Robert Adjei',
              title: 'IT Project Manager',
              role: 'evaluator',
              sentiment: 'neutral',
              recentNotes: 'Single-threaded deal. Need introduction to Banking Operations Director.',
            },
          ],
          previousCallTakeaways: [
            'Deal stalled for 19 days in Solution Design.',
            'Robert flagged internal budget scrutiny on software additions.',
          ],
          strategicTalkTrack: [
            'Highlight compliance automation reducing manual audit costs by 150 hours/quarter.',
            'Request warm introduction to the Banking Operations Director to align on business metrics.',
          ],
          recommendedQuestions: [
            'Robert, how is executive leadership measuring automation ROI this fiscal year?',
            'Can we include the Operations Director on our next review to align technical and business KPIs?',
          ],
          desiredOutcomeChecklist: [
            { id: 'chk_4', label: 'Identify economic buyer and obtain intro', completed: false },
            { id: 'chk_5', label: 'Establish renewed stage timeline', completed: false },
          ],
          status: 'upcoming',
          createdAt: now,
          updatedAt: now,
        },
      ];

      const batchBriefs = adminDb.batch();
      for (const brief of sampleBriefs) {
        batchBriefs.set(briefsRef.doc(brief.id), brief);
      }
      await batchBriefs.commit();
      meetingBriefsCreated = sampleBriefs.length;
    }

    return {
      success: true,
      workspaceId,
      governanceProvisioned,
      signalsCreated,
      dealHealthCardsCreated,
      stakeholderMapsCreated,
      meetingBriefsCreated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown migration error';
    return {
      success: false,
      workspaceId,
      governanceProvisioned: false,
      signalsCreated: 0,
      dealHealthCardsCreated: 0,
      stakeholderMapsCreated: 0,
      meetingBriefsCreated: 0,
      error: message,
    };
  }
}
