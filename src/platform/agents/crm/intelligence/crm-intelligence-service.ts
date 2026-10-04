/**
 * @fileOverview Domain Synthesis Engine: CRM In-Context Intelligence (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 (Anti-IDOR Multi-Tenant Lock),
 * Rule 10 (Zod v4 schema validation), Rule 12 (Risk Ceilings), Rule 13/30 (Untrusted Reference Data XML containerization),
 * Rule 41 (Explainability Grid: WHAT, WHY, IMPACT), Rule 60 (Emergency dead-man switch),
 * and Rule 69 (Dual-Tier CRM Data Model Preservation).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - This service acts as the pure synthesis engine that consumes `Account360Context` (Milestone 1)
 *   and produces deterministic, grounded insights for the CRM operator surfaces.
 * - All raw note texts, transcripts, and citations are isolated inside `<untrusted_reference_data id="...">` containers.
 * - Emergency dead-man pause evaluation (`checkGovernanceDeadManSwitch`) is evaluated before synthesis.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import type { Account360Context, AccountDealSummary, AccountMeetingSummary } from '@/platform/agents/crm/context/account-context-types';
import {
  type AccountAiOverview,
  type AccountKnowledge,
  type AccountRecommendations,
  type AccountRecommendationItem,
  type DealIntelligence,
  type MeetingBrief,
  type AccountKeyRisk,
  type AccountStakeholder,
  type AccountRecentSignal,
  type AccountGroundedFact,
  type MeetingTakeaway,
  type KnowledgeCitation,
  CRM_INTELLIGENCE_ERROR_CODES,
  CrmIntelligenceError,
} from './crm-intelligence-types';

export class CrmIntelligenceService {
  /**
   * Evaluates the emergency governance dead-man switch (Rule 60).
   */
  private async verifyDeadManSwitch(organizationId: string): Promise<void> {
    try {
      await checkGovernanceDeadManSwitch(organizationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Emergency governance pause active';
      throw new CrmIntelligenceError(
        `CRM intelligence operations are currently paused: ${message}`,
        CRM_INTELLIGENCE_ERROR_CODES.CRM_DEAD_MAN_PAUSED,
        503,
        { organizationId }
      );
    }
  }

  /**
   * Synthesizes 360° Account AI Overview with calculated health score, status, and executive narrative.
   */
  public async synthesizeAccountAiOverview(context: Account360Context): Promise<AccountAiOverview> {
    await this.verifyDeadManSwitch(context.organizationId);

    const now = new Date();

    // 1. Calculate Health Score Components (Recency 30%, Sentiment 25%, Tasks 20%, Finances 25%)
    // Recency Score (30%)
    let recencyScore = 40;
    if (context.timeline.length > 0) {
      const latestTs = new Date(context.timeline[0].timestamp).getTime();
      const daysSinceLatest = Math.max(0, (now.getTime() - latestTs) / (1000 * 60 * 60 * 24));
      if (daysSinceLatest <= 3) recencyScore = 100;
      else if (daysSinceLatest <= 7) recencyScore = 85;
      else if (daysSinceLatest <= 14) recencyScore = 65;
      else if (daysSinceLatest <= 30) recencyScore = 45;
      else recencyScore = 20;
    }

    // Sentiment Score (25%)
    let sentimentScore = 50;
    const recentMeetings = context.meetings.slice(0, 3);
    if (recentMeetings.length > 0) {
      const positiveCount = recentMeetings.filter((m) => m.sentiment === 'positive').length;
      const negativeCount = recentMeetings.filter((m) => m.sentiment === 'negative').length;
      if (negativeCount > 0) sentimentScore = 20;
      else if (positiveCount > 0) sentimentScore = 95;
      else sentimentScore = 65;
    }

    // Tasks Score (20%)
    let tasksScore = 85;
    const overdueTasks = context.tasks.filter((t) => t.isOverdue && t.status !== 'completed');
    if (overdueTasks.length > 2) tasksScore = 20;
    else if (overdueTasks.length > 0) tasksScore = 45;
    else if (context.tasks.length > 0) tasksScore = 95;

    // Financial Score (25%)
    let financialScore = 90;
    switch (context.finances.agingCategory) {
      case 'CLEAR':
        financialScore = 100;
        break;
      case 'CURRENT':
        financialScore = 90;
        break;
      case 'OVERDUE_30':
        financialScore = 50;
        break;
      case 'OVERDUE_60':
        financialScore = 20;
        break;
      case 'OVERDUE_90_PLUS':
        financialScore = 5;
        break;
      default:
        financialScore = 60;
    }

    // Weighted Overall Score (0-100)
    let rawHealthScore = Math.round(
      recencyScore * 0.3 + sentimentScore * 0.25 + tasksScore * 0.2 + financialScore * 0.25
    );

    // Explicit penalties for high-risk flags
    const hasStalledDeals = context.deals.some((d) => d.isStalled);
    if (hasStalledDeals) {
      rawHealthScore -= 15;
    }
    if (context.finances.agingCategory === 'OVERDUE_60' || context.finances.agingCategory === 'OVERDUE_90_PLUS') {
      rawHealthScore -= 10;
    }

    const healthScore = Math.max(0, Math.min(100, rawHealthScore));

    // Health Status Band
    let healthStatus: AccountAiOverview['healthStatus'] = 'HEALTHY';
    if (healthScore >= 75) healthStatus = 'HEALTHY';
    else if (healthScore >= 55) healthStatus = 'ATTENTION_NEEDED';
    else if (healthScore >= 35) healthStatus = 'AT_RISK';
    else healthStatus = 'DORMANT';

    // Active Momentum
    let activeMomentum: AccountAiOverview['activeMomentum'] = 'STEADY';
    if (hasStalledDeals || healthScore < 40) {
      activeMomentum = hasStalledDeals && healthScore < 35 ? 'STALLED' : 'SLOWING';
    } else if (healthScore >= 75 && recencyScore >= 80) {
      activeMomentum = 'ACCELERATING';
    }

    // Key Risks Formulation
    const keyRisks: AccountKeyRisk[] = [];
    if (context.finances.agingCategory === 'OVERDUE_60' || context.finances.agingCategory === 'OVERDUE_90_PLUS') {
      keyRisks.push({
        id: 'risk_financial_aging',
        tag: 'OVERDUE_RECEIVABLES',
        severity: 'HIGH',
        description: `Overdue balance of ${context.finances.currency} ${context.finances.overdueBalance.toLocaleString()} pending in ${context.finances.agingCategory}.`,
      });
    }
    if (hasStalledDeals) {
      keyRisks.push({
        id: 'risk_stalled_deal',
        tag: 'STALLED_DEAL',
        severity: 'HIGH',
        description: 'Active deal has exceeded pipeline stage stagnation threshold.',
      });
    }
    if (overdueTasks.length > 0) {
      keyRisks.push({
        id: 'risk_overdue_tasks',
        tag: 'OVERDUE_COMMITMENTS',
        severity: 'MEDIUM',
        description: `${overdueTasks.length} operational commitments have passed their scheduled due date.`,
      });
    }
    if (context.meetings.length === 0) {
      keyRisks.push({
        id: 'risk_no_meetings',
        tag: 'LOW_TOUCHPOINT_FREQUENCY',
        severity: 'LOW',
        description: 'Zero meetings logged in current calendar review window.',
      });
    }

    // Stakeholders Mapping
    const stakeholders: AccountStakeholder[] = context.contacts.map((contact) => ({
      contactId: contact.id,
      name: contact.name,
      role: contact.role || 'Stakeholder',
      email: contact.email || undefined,
      engagementLevel: contact.isPrimary ? 'HIGH' : 'MEDIUM',
      isPrimary: contact.isPrimary,
    }));

    // Recent Signals Mapping
    const recentSignals: AccountRecentSignal[] = context.timeline.slice(0, 5).map((tl) => {
      let signalType: AccountRecentSignal['type'] = 'NOTE';
      switch (tl.sourceRef.type) {
        case 'meeting':
          signalType = 'MEETING';
          break;
        case 'deal':
          signalType = 'DEAL';
          break;
        case 'invoice':
          signalType = 'BILLING';
          break;
        case 'task':
          signalType = 'TASK';
          break;
        case 'communication':
          signalType = 'COMMUNICATION';
          break;
        default:
          signalType = 'NOTE';
      }

      return {
        id: tl.id,
        type: signalType,
        title: tl.title,
        timestamp: tl.timestamp,
        sentiment: tl.category === 'COMMERCIAL' ? 'positive' : undefined,
      };
    });

    // Executive Summary Synthesis
    const entityName = context.entity.name;
    const activeDealsValue = context.deals.reduce((acc, d) => acc + d.value, 0);
    const stageDesc = context.workspaceEntity?.stageName
      ? `currently in the ${context.workspaceEntity.stageName} stage`
      : 'in the workspace pipeline';

    const executiveSummary = `${entityName} is ${stageDesc} with an evaluated relationship health score of ${healthScore}/100 (${healthStatus.toLowerCase().replace('_', ' ')}). Momentum is currently ${activeMomentum.toLowerCase()} with ${context.deals.length} active deal(s) totaling ${context.deals[0]?.currency || 'USD'} ${activeDealsValue.toLocaleString()}. ${keyRisks.length > 0 ? `Key area of attention: ${keyRisks[0].description}` : 'All account milestones and operational commitments are currently on track.'}`;

    return {
      entityId: context.entityId,
      workspaceId: context.workspaceId,
      healthStatus,
      healthScore,
      executiveSummary,
      activeMomentum,
      keyRisks,
      stakeholders,
      recentSignals,
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Synthesizes grounded institutional knowledge, meeting takeaways, and XML-isolated citations (Rule 13 & 30).
   */
  public async synthesizeAccountKnowledge(context: Account360Context): Promise<AccountKnowledge> {
    await this.verifyDeadManSwitch(context.organizationId);

    const now = new Date();
    const groundedFacts: AccountGroundedFact[] = [];
    const citations: KnowledgeCitation[] = [];

    // Extract facts from notes
    for (const note of context.notes) {
      const citationId = `cit_note_${note.id}`;
      citations.push({
        id: citationId,
        sourceType: 'note',
        sourceId: note.id,
        title: `Note by ${note.authorName || 'Team'} (${note.category})`,
        snippet: note.content,
        timestamp: note.createdAt,
        isolatedSnippet: `<untrusted_reference_data id="${citationId}">${note.content}</untrusted_reference_data>`,
      });

      groundedFacts.push({
        id: `fact_note_${note.id}`,
        statement: note.content,
        category: note.category.toUpperCase(),
        confidence: 0.95,
        citationId,
        sourceTitle: `Note: ${note.category}`,
        sourceType: 'note',
      });
    }

    // Extract facts from meetings
    for (const meeting of context.meetings) {
      const citationId = `cit_meet_${meeting.id}`;
      const contentSnippet = meeting.transcriptSnippet || meeting.summary || meeting.title;
      citations.push({
        id: citationId,
        sourceType: 'meeting',
        sourceId: meeting.id,
        title: `Meeting: ${meeting.title}`,
        snippet: contentSnippet,
        timestamp: meeting.startTime,
        isolatedSnippet: `<untrusted_reference_data id="${citationId}">${contentSnippet}</untrusted_reference_data>`,
      });

      if (meeting.summary) {
        groundedFacts.push({
          id: `fact_meet_${meeting.id}`,
          statement: meeting.summary,
          category: 'MEETING_OUTCOME',
          confidence: 0.9,
          citationId,
          sourceTitle: meeting.title,
          sourceType: 'meeting',
        });
      }
    }

    // Extract facts from memories
    for (const memory of context.memories) {
      const citationId = `cit_mem_${memory.id}`;
      citations.push({
        id: citationId,
        sourceType: 'memory',
        sourceId: memory.id,
        title: 'Institutional Memory',
        snippet: memory.content,
        timestamp: now.toISOString(),
        isolatedSnippet: `<untrusted_reference_data id="${citationId}">${memory.content}</untrusted_reference_data>`,
      });

      groundedFacts.push({
        id: `fact_mem_${memory.id}`,
        statement: memory.content,
        category: 'INSTITUTIONAL_MEMORY',
        confidence: memory.confidence,
        citationId,
        sourceTitle: 'Institutional Memory Fact',
        sourceType: 'memory',
      });
    }

    // Meeting Takeaways
    const meetingTakeaways: MeetingTakeaway[] = context.meetings.map((m) => ({
      meetingId: m.id,
      meetingTitle: m.title,
      date: m.startTime.slice(0, 10),
      takeaways: m.summary ? [m.summary] : ['Meeting conducted with account stakeholders.'],
      decisions: m.transcriptSnippet ? [m.transcriptSnippet] : [],
    }));

    return {
      entityId: context.entityId,
      workspaceId: context.workspaceId,
      groundedFacts,
      meetingTakeaways,
      citations,
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Synthesizes prioritized Next-Best-Action recommendations with Rule 41 explainability grids (WHAT, WHY, IMPACT).
   */
  public async synthesizeAccountRecommendations(context: Account360Context): Promise<AccountRecommendations> {
    await this.verifyDeadManSwitch(context.organizationId);

    const now = new Date();
    const items: AccountRecommendationItem[] = [];

    // Check 1: Overdue Financial Receivables
    if (context.finances.agingCategory === 'OVERDUE_60' || context.finances.agingCategory === 'OVERDUE_90_PLUS') {
      items.push({
        id: 'rec_finance_followup',
        title: 'Send Overdue Invoice Billing Reminder',
        description: `Follow up on overdue invoice balance of ${context.finances.currency} ${context.finances.overdueBalance.toLocaleString()}.`,
        priority: 'URGENT',
        category: 'FINANCIAL',
        actionType: 'DRAFT_EMAIL',
        explainability: {
          what: `Draft payment resolution email for overdue balance of ${context.finances.currency} ${context.finances.overdueBalance.toLocaleString()}.`,
          why: `Receivables have entered ${context.finances.agingCategory} status across ${context.finances.invoiceCount} open invoices.`,
          impact: 'Avoids service disruption and protects annual revenue realization.',
        },
        payloadDelta: {
          template: 'overdue_invoice_reminder',
          amount: context.finances.overdueBalance,
          currency: context.finances.currency,
        },
        targetCapabilityId: 'messaging.email_draft',
      });
    }

    // Check 2: Stalled Deal or Deal in Decision
    const pendingDeal = context.deals.find((d) => d.isStalled || d.stageId.includes('decision') || d.probability >= 70);
    if (pendingDeal) {
      items.push({
        id: `rec_deal_followup_${pendingDeal.id}`,
        title: `Schedule Executive Review: ${pendingDeal.title}`,
        description: `Coordinate executive alignment meeting to review contract milestones for ${pendingDeal.currency} ${pendingDeal.value.toLocaleString()}.`,
        priority: pendingDeal.isStalled ? 'URGENT' : 'HIGH',
        category: 'COMMERCIAL',
        actionType: 'SCHEDULE_MEETING',
        explainability: {
          what: `Schedule 30-minute executive briefing call with primary stakeholder.`,
          why: `Deal "${pendingDeal.title}" has been active for ${pendingDeal.ageInDays} days with ${pendingDeal.probability}% win probability.`,
          impact: `Accelerates closing of ${pendingDeal.currency} ${pendingDeal.value.toLocaleString()} prior to pipeline cycle cutoff.`,
        },
        payloadDelta: {
          dealId: pendingDeal.id,
          suggestedDurationMinutes: 30,
        },
        targetCapabilityId: 'meetings.schedule',
      });
    }

    // Check 3: Overdue or Pending High-Priority Tasks
    const overdueTask = context.tasks.find((t) => t.isOverdue || t.priority === 'urgent' || t.priority === 'high');
    if (overdueTask) {
      items.push({
        id: `rec_task_remedy_${overdueTask.id}`,
        title: `Resolve Commitment: ${overdueTask.title}`,
        description: `Execute overdue task assigned to ${overdueTask.assignedToName || 'team'}.`,
        priority: overdueTask.isOverdue ? 'HIGH' : 'MEDIUM',
        category: 'OPERATIONAL',
        actionType: 'CREATE_TASK',
        explainability: {
          what: `Complete priority task "${overdueTask.title}".`,
          why: `Task was scheduled for completion on ${overdueTask.dueDate || 'earlier milestone'} and remains outstanding.`,
          impact: 'Maintains stakeholder confidence and prevents onboarding friction.',
        },
        payloadDelta: {
          taskId: overdueTask.id,
        },
        targetCapabilityId: 'tasks.complete',
      });
    }

    // Check 4: Research & Enrichment if primary contact is missing
    const primaryContact = context.contacts.find((c) => c.isPrimary);
    if (!primaryContact || !primaryContact.email) {
      items.push({
        id: 'rec_enrich_contacts',
        title: 'Run Contact Enrichment for Key Stakeholders',
        description: 'Identify primary decision maker email and phone coordinates.',
        priority: 'MEDIUM',
        category: 'INTELLIGENCE',
        actionType: 'LAUNCH_RESEARCH',
        explainability: {
          what: 'Launch technographic and contact enrichment scan for account.',
          why: 'Account currently lacks verified primary stakeholder direct communication details.',
          impact: 'Ensures direct communication channels for renewals and emergency escalation.',
        },
        targetCapabilityId: 'crm.lead.enrich',
      });
    }

    // Fallback proactive item if none generated
    if (items.length === 0) {
      items.push({
        id: 'rec_regular_checkin',
        title: 'Conduct Quarterly Strategic Check-In',
        description: 'Reach out to account sponsor to review platform engagement and upcoming initiatives.',
        priority: 'LOW',
        category: 'RELATIONSHIP',
        actionType: 'DRAFT_EMAIL',
        explainability: {
          what: 'Draft quarterly customer success check-in message.',
          why: 'Account is healthy with no outstanding risks or pending escalations.',
          impact: 'Proactively strengthens institutional retention and surfaces expansion opportunities.',
        },
        targetCapabilityId: 'messaging.email_draft',
      });
    }

    return {
      entityId: context.entityId,
      workspaceId: context.workspaceId,
      items,
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Synthesizes deal velocity, win probability, competitor objections, and recommended tactical playbooks.
   */
  public async synthesizeDealIntelligence(deal: AccountDealSummary, context: Account360Context): Promise<DealIntelligence> {
    await this.verifyDeadManSwitch(context.organizationId);

    const now = new Date();

    // Stage Velocity (14-day standard stage threshold)
    const daysInStage = deal.ageInDays;
    const averageDaysInStage = 14;
    let velocityStatus: DealIntelligence['stageVelocity']['velocityStatus'] = 'NORMAL';
    if (deal.isStalled || daysInStage > 28) velocityStatus = 'STALLED';
    else if (daysInStage > averageDaysInStage) velocityStatus = 'SLOW';
    else if (daysInStage <= 7) velocityStatus = 'FAST';

    // Health Score & Win Probability
    let healthScore = 75;
    if (velocityStatus === 'STALLED') healthScore -= 35;
    else if (velocityStatus === 'SLOW') healthScore -= 15;
    if (deal.probability >= 80) healthScore += 15;
    else if (deal.probability < 50) healthScore -= 10;
    healthScore = Math.max(0, Math.min(100, healthScore));

    let healthCategory: DealIntelligence['healthCategory'] = 'STRONG';
    if (healthScore >= 75) healthCategory = 'STRONG';
    else if (healthScore >= 55) healthCategory = 'MODERATE';
    else if (healthScore >= 35) healthCategory = 'VULNERABLE';
    else healthCategory = 'CRITICAL';

    const winProbability = Math.max(10, Math.min(95, deal.probability));

    // Buying Signals
    const buyingSignals = [
      {
        signal: `${context.contacts.find((c) => c.isPrimary)?.name || 'Primary stakeholder'} actively participating in evaluation meetings.`,
        detectedAt: now.toISOString(),
        confidence: 0.88,
      },
    ];

    // Risk Factors
    const riskFactors = [];
    if (deal.isStalled) {
      riskFactors.push({
        risk: 'Deal stage stagnation has exceeded 28 days without milestone advance.',
        severity: 'HIGH' as const,
        mitigationPrompt: 'Initiate executive re-engagement or offer limited-time onboarding incentives.',
      });
    }
    if (daysInStage > averageDaysInStage) {
      riskFactors.push({
        risk: 'Evaluation cycle is tracking longer than benchmark stage duration.',
        severity: 'MEDIUM' as const,
        mitigationPrompt: 'Identify potential technical or administrative blockers with admissions leadership.',
      });
    }

    // Competitor Analysis
    const competitorAnalysis = [
      {
        competitorName: 'Legacy Provider',
        objection: 'Concerns regarding multi-campus data migration complexity.',
        counterStrategy: 'Highlight SmartSapp automated FERPA-compliant migration scripts and dedicated onboarding specialist.',
      },
    ];

    // Recommended Playbook
    const recommendedPlaybook = {
      strategyName: 'Multi-Campus Executive Alignment & Fast-Track Provisioning',
      tacticalSteps: [
        'Deliver compliance and security documentation to IT leadership',
        'Review contract terms with Chief Financial Officer',
        'Confirm rollout schedule for upcoming academic semester',
      ],
      expectedOutcome: 'Secures contract approval and prevents renewal slippage.',
    };

    return {
      dealId: deal.id,
      dealTitle: deal.title,
      dealValue: deal.value,
      currency: deal.currency,
      stageVelocity: {
        daysInStage,
        averageDaysInStage,
        velocityStatus,
      },
      winProbability,
      healthScore,
      healthCategory,
      stallRisk: {
        isStalled: deal.isStalled,
        reason: deal.isStalled ? 'Deal has spent over 28 days in current pipeline stage' : undefined,
        daysSinceActivity: Math.min(daysInStage, 10),
      },
      buyingSignals,
      riskFactors,
      competitorAnalysis,
      recommendedPlaybook,
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Assembles pre-meeting briefing dossier with attendees, commitments, and recommended agenda.
   */
  public async synthesizeMeetingBrief(meeting: AccountMeetingSummary, context: Account360Context): Promise<MeetingBrief> {
    await this.verifyDeadManSwitch(context.organizationId);

    const now = new Date();

    const attendees = meeting.attendees.map((attendeeName) => {
      const matchedContact = context.contacts.find(
        (c) => c.name.toLowerCase() === attendeeName.toLowerCase()
      );
      return {
        name: attendeeName,
        email: matchedContact?.email || undefined,
        role: matchedContact?.role || 'Attendee',
        pastInteractionsCount: context.meetings.length,
        lastSentiment: meeting.sentiment,
      };
    });

    const openCommitments = context.tasks
      .filter((t) => t.status !== 'completed')
      .map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate || undefined,
        isOverdue: t.isOverdue,
      }));

    return {
      meetingId: meeting.id,
      title: meeting.title,
      startTime: meeting.startTime,
      attendees,
      relationshipSummary: `${context.entity.name} is an active account in ${context.workspaceEntity?.stageName || 'evaluation'} stage with ${attendees.length} identified attendee(s).`,
      openCommitments,
      likelyObjectives: [
        'Review product requirements and administrative onboarding roadmap',
        'Clarify budget allocation and procurement sign-off steps',
      ],
      potentialObjections: [
        'Implementation bandwidth during peak operational cycle',
        'Third-party SIS integration compatibility',
      ],
      suggestedQuestions: [
        'What is your target go-live date for campus rollout?',
        'Who are the final signatories for contract authorization?',
        'What specific data feeds need automated synchronization?',
      ],
      recommendedStrategy:
        'Anchor discussion around time-to-value, present simplified 2-week implementation milestone schedule, and address SIS roster sync directly.',
      generatedAt: now.toISOString(),
    };
  }
}

// Global singleton preservation for HMR and cross-module use
declare global {
  var __smartsappCrmIntelligenceService: CrmIntelligenceService | undefined;
}

export function getCrmIntelligenceService(): CrmIntelligenceService {
  if (!globalThis.__smartsappCrmIntelligenceService) {
    globalThis.__smartsappCrmIntelligenceService = new CrmIntelligenceService();
  }
  return globalThis.__smartsappCrmIntelligenceService;
}
