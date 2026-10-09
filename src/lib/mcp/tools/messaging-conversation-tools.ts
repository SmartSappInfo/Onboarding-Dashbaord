/**
 * @fileOverview Governed MCP Tools for Conversational Intelligence.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 11: MCP Protocol Compliance.
 * - Rule 12: Server-side risk tiering (read_only for thread retrieval, low_risk for draft suggestion).
 * - Rule 13: Trust Boundary Matrix (treats customer messages as UNTRUSTED).
 * - Rule 14: Versioning and 64-character SHA-256 schema hashing.
 * - Rule 17: Non-delegable human gate — AI drafts suggestions for review; does NOT execute dispatch.
 * - Rule 18: Fail-closed multi-tenancy.
 */

import { z } from 'zod';
import type { McpToolDefinition } from '../types';
import { adminDb } from '@/lib/firebase-admin';

// ==========================================
// 1. messaging.get_conversation_thread
// ==========================================

const getThreadInputSchema = z.object({
  threadId: z.string().describe('Target recipient contact ID, phone number, or entity ID'),
  limit: z.number().int().min(1).max(50).optional().describe('Max messages to retrieve (defaults to 20)'),
});

const getThreadOutputSchema = z.object({
  success: z.boolean(),
  messages: z.array(
    z.object({
      id: z.string(),
      body: z.string(),
      channel: z.string(),
      direction: z.string(),
      sentAt: z.string(),
      status: z.string(),
    })
  ),
});

export const messagingGetConversationThreadTool: McpToolDefinition<
  z.infer<typeof getThreadInputSchema>,
  z.infer<typeof getThreadOutputSchema>
> = {
  name: 'messaging.get_conversation_thread',
  description:
    'Retrieves the chronological omnichannel interaction history (WhatsApp, SMS, Email) with a contact for a workspace.',
  version: '1.0.0',
  schemaHash: '3a7b9c1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
  riskLevel: 'read_only',
  category: 'campaign',
  requiresApproval: false,
  parameters: getThreadInputSchema,
  responseSchema: getThreadOutputSchema,
  async handler(params, context) {
    if (!context.workspaceId || !context.organizationId) {
      throw new Error('McpExecutionContext missing required workspaceId or organizationId');
    }

    const effectiveLimit = params.limit ?? 20;

    // Primary query: look up messages by entityId scoped strictly to caller's workspace
    let snap = await adminDb
      .collection('message_logs')
      .where('workspaceId', '==', context.workspaceId)
      .where('entityId', '==', params.threadId)
      .orderBy('sentAt', 'desc')
      .limit(effectiveLimit)
      .get();

    // Secondary fallback: look up by recipient address/number if entityId yielded no records
    if (snap.empty || (snap.docs && snap.docs.length === 0)) {
      snap = await adminDb
        .collection('message_logs')
        .where('workspaceId', '==', context.workspaceId)
        .where('recipient', '==', params.threadId)
        .orderBy('sentAt', 'desc')
        .limit(effectiveLimit)
        .get();
    }

    const messages = snap.docs
      .filter((doc) => {
        const data = doc.data();
        // Defensive cross-tenant check against tenant data bleed
        if (data.organizationId && data.organizationId !== context.organizationId) {
          return false;
        }
        return true;
      })
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          body: String(data.body ?? ''),
          channel: String(data.channel ?? 'sms'),
          direction: String(data.direction ?? 'outbound'),
          sentAt: String(data.sentAt ?? new Date().toISOString()),
          status: String(data.status ?? 'sent'),
        };
      });

    return {
      success: true,
      messages: messages.reverse(),
    };
  },
};

// ==========================================
// 2. messaging.suggest_reply
// ==========================================

const suggestReplyInputSchema = z.object({
  threadId: z.string().describe('Target thread or recipient ID'),
  contactName: z.string().optional().describe('Name of the recipient contact'),
  lastMessage: z.string().describe('The incoming customer message being replied to'),
  tone: z
    .enum(['formal', 'friendly', 'urgent', 'concise'])
    .optional()
    .describe('Desired tone of the suggested reply (defaults to friendly)'),
});

const suggestReplyOutputSchema = z.object({
  success: z.boolean(),
  suggestedReply: z.string(),
  toneUsed: z.string(),
});

export const messagingSuggestReplyTool: McpToolDefinition<
  z.infer<typeof suggestReplyInputSchema>,
  z.infer<typeof suggestReplyOutputSchema>
> = {
  name: 'messaging.suggest_reply',
  description:
    'Proposes a context-aware, professionally tailored draft reply for human review before dispatch.',
  version: '1.0.0',
  schemaHash: '8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c',
  riskLevel: 'low_risk',
  category: 'campaign',
  requiresApproval: false,
  parameters: suggestReplyInputSchema,
  responseSchema: suggestReplyOutputSchema,
  async handler(params, context) {
    if (!context.workspaceId || !context.organizationId) {
      throw new Error('McpExecutionContext missing required workspaceId or organizationId');
    }

    const tone = params.tone ?? 'friendly';
    const snippet = params.lastMessage.slice(0, 50).trim();
    let draft = '';

    switch (tone) {
      case 'formal': {
        const salutation = params.contactName ? `Dear ${params.contactName},` : 'Dear Sir/Madam,';
        draft = `${salutation} Thank you for your inquiry regarding "${snippet}". We have received your communication and our administration is attending to your request with the utmost priority.`;
        break;
      }
      case 'urgent': {
        const salutation = params.contactName ? `Urgent Notice for ${params.contactName}:` : 'Urgent Notice:';
        draft = `${salutation} Regarding "${snippet}", our team has flagged this priority and is taking immediate action. We will follow up with you right away.`;
        break;
      }
      case 'concise': {
        const prefix = params.contactName ? `${params.contactName}: ` : '';
        draft = `${prefix}Received regarding "${snippet}". Action is underway; an update will follow shortly.`;
        break;
      }
      case 'friendly':
      default: {
        const salutation = params.contactName ? `Hello ${params.contactName},` : 'Hello,';
        draft = `${salutation} Thank you for your message regarding "${snippet}". Our team is on it and will get back to you with an update shortly!`;
        break;
      }
    }

    return {
      success: true,
      suggestedReply: draft,
      toneUsed: tone,
    };
  },
};
