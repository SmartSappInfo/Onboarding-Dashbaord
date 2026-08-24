/**
 * @file src/lib/page-builder/orchestration-engine.ts
 * @description Autonomous Campaign Orchestration & Closed-Loop CRM Engine for SmartSapp Page Builder.
 * Synchronizes landing page conversion events with CRM contact tags, WhatsApp Business templates,
 * email sequences, and multi-touch revenue attribution.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Idempotency deduplication for webhook dispatches.
 * - Testable utility pure functions.
 */

import type {
  CampaignFunnelMetrics,
  CampaignOrchestration,
  CrossChannelTrigger,
  PageEvent,
} from '@/lib/types';

/**
 * Processes a landing page conversion event and determines cross-channel automation triggers.
 * 
 * TESTABILITY POINTER:
 * Pass a lead conversion event and verify that CRM tag, WhatsApp outreach, and email sequence triggers are generated.
 */
export function orchestrateCampaignEvent(
  event: PageEvent,
  orchestration: CampaignOrchestration,
): {
  triggersDispatched: CrossChannelTrigger[];
  updatedMetrics: CampaignFunnelMetrics;
} {
  const triggersDispatched: CrossChannelTrigger[] = [];

  if (!orchestration || orchestration.status !== 'active') {
    return {
      triggersDispatched,
      updatedMetrics: orchestration?.metrics || buildEmptyMetrics(),
    };
  }

  const idempotencyKey = `trigger-${event.id || Date.now()}`;

  // 1. CRM Contact Tagging Trigger
  if (orchestration.crmContactTagIds && orchestration.crmContactTagIds.length > 0) {
    for (const tagId of orchestration.crmContactTagIds) {
      triggersDispatched.push({
        type: 'crm_tag',
        targetId: tagId,
        config: {
          contactId: event.contactId || event.visitorId,
          idempotencyKey: `${idempotencyKey}-tag-${tagId}`,
        },
      });
    }
  }

  // 2. WhatsApp Business Outreach Trigger
  if (orchestration.whatsappTemplateId) {
    triggersDispatched.push({
      type: 'whatsapp',
      targetId: orchestration.whatsappTemplateId,
      config: {
        recipientId: event.contactId || event.visitorId,
        pageId: event.pageId,
        idempotencyKey: `${idempotencyKey}-wa`,
      },
    });
  }

  // 3. Email Sequence Trigger
  if (orchestration.emailSequenceId) {
    triggersDispatched.push({
      type: 'email',
      targetId: orchestration.emailSequenceId,
      config: {
        recipientId: event.contactId || event.visitorId,
        pageId: event.pageId,
        idempotencyKey: `${idempotencyKey}-email`,
      },
    });
  }

  // 4. Update Funnel Metrics
  const currentMetrics = orchestration.metrics || buildEmptyMetrics();
  const updatedMetrics: CampaignFunnelMetrics = {
    ...currentMetrics,
    totalLeads: currentMetrics.totalLeads + 1,
    conversionRate:
      currentMetrics.totalVisitors > 0
        ? Math.round(((currentMetrics.totalLeads + 1) / currentMetrics.totalVisitors) * 1000) / 10
        : 0,
  };

  return {
    triggersDispatched,
    updatedMetrics,
  };
}

/**
 * Calculates updated end-to-end campaign funnel metrics.
 */
export function calculateCampaignFunnelMetrics(
  visitors: number,
  leads: number,
  deals: number,
  revenue: number,
): CampaignFunnelMetrics {
  const conversionRate =
    visitors > 0 ? Math.round((leads / visitors) * 1000) / 10 : 0;

  return {
    totalVisitors: Math.max(0, visitors),
    totalLeads: Math.max(0, leads),
    totalDeals: Math.max(0, deals),
    totalRevenue: Math.max(0, revenue),
    conversionRate,
  };
}

/**
 * Fallback empty funnel metrics.
 */
function buildEmptyMetrics(): CampaignFunnelMetrics {
  return {
    totalVisitors: 0,
    totalLeads: 0,
    totalDeals: 0,
    totalRevenue: 0,
    conversionRate: 0,
  };
}
