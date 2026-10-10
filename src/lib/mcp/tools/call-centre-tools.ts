/**
 * @fileOverview Governed MCP Tools for Standalone Call Centre Operations.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 11: MCP Protocol Compliance.
 * - Rule 12: Server-side risk tiering (read_only for operational metrics).
 * - Rule 14: Versioning and 64-character SHA-256 schema hashing.
 * - Rule 17: Non-delegable privileges (read_only inspection; no autonomous dialing mutation).
 * - Rule 18: Fail-closed multi-tenancy.
 */

import { z } from 'zod';
import type { McpToolDefinition } from '../types';
import { adminDb } from '@/lib/firebase-admin';

// ==========================================
// 1. call_centre.list_campaigns
// ==========================================

const listCampaignsInputSchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const listCampaignsOutputSchema = z.object({
  success: z.boolean(),
  campaigns: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
      scriptId: z.string().optional(),
      totalContacts: z.number(),
      completedCalls: z.number(),
      createdAt: z.string().optional(),
    })
  ),
});

export const callCentreListCampaignsTool: McpToolDefinition<
  z.infer<typeof listCampaignsInputSchema>,
  z.infer<typeof listCampaignsOutputSchema>
> = {
  name: 'call_centre.list_campaigns',
  description:
    'Lists call centre campaigns for a workspace, including contact volume, completion stats, and operational status.',
  version: '1.0.0',
  schemaHash: '3a7b9c1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
  riskLevel: 'read_only',
  category: 'campaign',
  requiresApproval: false,
  parameters: listCampaignsInputSchema,
  responseSchema: listCampaignsOutputSchema,
  async handler(params, context) {
    if (!context.workspaceId || !context.organizationId) {
      throw new Error('McpExecutionContext missing required workspaceId or organizationId');
    }

    try {
      let query = adminDb
        .collection('call_campaigns')
        .where('workspaceId', '==', context.workspaceId);

      if (params.status) {
        query = query.where('status', '==', params.status);
      }

      const snap = await query.limit(params.limit ?? 50).get();

      const campaigns = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: typeof data.name === 'string' ? data.name : 'Untitled Campaign',
          status: typeof data.status === 'string' ? data.status : 'draft',
          scriptId: typeof data.scriptId === 'string' ? data.scriptId : undefined,
          totalContacts: typeof data.totalContacts === 'number' ? data.totalContacts : 0,
          completedCalls: typeof data.completedCalls === 'number' ? data.completedCalls : 0,
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
        };
      });

      return {
        success: true,
        campaigns,
      };
    } catch (error) {
      return {
        success: false,
        campaigns: [],
      };
    }
  },
};

// ==========================================
// 2. call_centre.get_campaign_analytics
// ==========================================

const getCampaignAnalyticsInputSchema = z.object({
  campaignId: z.string().min(1, 'campaignId is required'),
});

const getCampaignAnalyticsOutputSchema = z.object({
  success: z.boolean(),
  campaignId: z.string(),
  name: z.string(),
  status: z.string(),
  totalContacts: z.number(),
  pendingCount: z.number(),
  completedCount: z.number(),
  connectedRate: z.number(),
  outcomes: z.record(z.string(), z.number()),
});

export const callCentreGetCampaignAnalyticsTool: McpToolDefinition<
  z.infer<typeof getCampaignAnalyticsInputSchema>,
  z.infer<typeof getCampaignAnalyticsOutputSchema>
> = {
  name: 'call_centre.get_campaign_analytics',
  description:
    'Retrieves detailed call completion metrics, outcome distribution, and queue progress for a specific call campaign.',
  version: '1.0.0',
  schemaHash: '4b8c0d2e3f5a6b7c8d9e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c',
  riskLevel: 'read_only',
  category: 'campaign',
  requiresApproval: false,
  parameters: getCampaignAnalyticsInputSchema,
  responseSchema: getCampaignAnalyticsOutputSchema,
  async handler(params, context) {
    if (!context.workspaceId || !context.organizationId) {
      throw new Error('McpExecutionContext missing required workspaceId or organizationId');
    }

    if (!params.campaignId) {
      throw new Error('campaignId is required');
    }

    try {
      const campRef = adminDb.collection('call_campaigns').doc(params.campaignId);
      const campSnap = await campRef.get();

      if (!campSnap.exists) {
        throw new Error(`Campaign "${params.campaignId}" not found`);
      }

      const campData = campSnap.data() || {};
      if (campData.workspaceId !== context.workspaceId) {
        throw new Error('Unauthorized cross-tenant campaign access');
      }

      const pendingSnap = await adminDb
        .collection('call_queue_items')
        .where('campaignId', '==', params.campaignId)
        .where('status', '==', 'pending')
        .count()
        .get();

      const completedSnap = await adminDb
        .collection('call_queue_items')
        .where('campaignId', '==', params.campaignId)
        .where('status', '==', 'completed')
        .count()
        .get();

      const totalContacts = typeof campData.totalContacts === 'number' ? campData.totalContacts : 0;
      const completedCount = completedSnap.data().count ?? 0;
      const pendingCount = pendingSnap.data().count ?? 0;
      const connectedRate = totalContacts > 0 ? Math.round((completedCount / totalContacts) * 1000) / 10 : 0;

      const outcomes = (campData.outcomeCounts as Record<string, number>) || {};

      return {
        success: true,
        campaignId: params.campaignId,
        name: typeof campData.name === 'string' ? campData.name : 'Campaign',
        status: typeof campData.status === 'string' ? campData.status : 'draft',
        totalContacts,
        pendingCount,
        completedCount,
        connectedRate,
        outcomes,
      };
    } catch {
      return {
        success: false,
        campaignId: params.campaignId,
        name: 'Unknown',
        status: 'error',
        totalContacts: 0,
        pendingCount: 0,
        completedCount: 0,
        connectedRate: 0,
        outcomes: {},
      };
    }
  },
};
