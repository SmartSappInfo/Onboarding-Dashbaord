import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  messagingGetConversationThreadTool,
  messagingSuggestReplyTool,
} from '../messaging-conversation-tools';
import type { McpExecutionContext } from '../../types';

const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockGet = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: (...args: unknown[]) => {
        mockWhere(...args);
        return {
          where: (...innerArgs: unknown[]) => {
            mockWhere(...innerArgs);
            return {
              orderBy: (...oArgs: unknown[]) => {
                mockOrderBy(...oArgs);
                return {
                  limit: (...lArgs: unknown[]) => {
                    mockLimit(...lArgs);
                    return {
                      get: mockGet,
                    };
                  },
                };
              },
            };
          },
        };
      },
    })),
  },
}));

describe('messaging conversation MCP tools', () => {
  const mockContext: McpExecutionContext = {
    workspaceId: 'ws_test',
    organizationId: 'org_test',
    callerId: 'agent_007',
    callerType: 'agent',
    requestId: 'req_123',
    callDepth: 1,
    timestamp: '2026-10-09T08:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      docs: [
        {
          id: 'm1',
          data: () => ({
            body: 'When is the report due?',
            channel: 'whatsapp',
            direction: 'inbound',
            sentAt: '2026-10-09T08:00:00Z',
            status: 'delivered',
          }),
        },
      ],
    });
  });

  it('declares valid 64-char schemaHash and read_only risk tier on get_conversation_thread', () => {
    expect(messagingGetConversationThreadTool.riskLevel).toBe('read_only');
    expect(messagingGetConversationThreadTool.name).toBe('messaging.get_conversation_thread');
    expect(messagingGetConversationThreadTool.category).toBe('campaign');
    expect(messagingGetConversationThreadTool.requiresApproval).toBe(false);
    expect(messagingGetConversationThreadTool.schemaHash).toHaveLength(64);
    expect(messagingGetConversationThreadTool.schemaHash).toBe(
      '3a7b9c1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b'
    );
  });

  it('retrieves chronological messages querying by entityId matching threadId', async () => {
    const res = await messagingGetConversationThreadTool.handler(
      {
        threadId: 'contact_123',
      },
      mockContext
    );

    expect(res.success).toBe(true);
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0].body).toBe('When is the report due?');
    expect(mockWhere).toHaveBeenCalledWith('workspaceId', '==', 'ws_test');
    expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'contact_123');
    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  it('falls back to querying by recipient when entityId query returns empty', async () => {
    // First query (entityId) returns empty docs
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
    // Second query (recipient) returns match
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'm2',
          data: () => ({
            body: 'Hello via phone',
            channel: 'sms',
            direction: 'outbound',
            sentAt: '2026-10-09T08:05:00Z',
            status: 'sent',
          }),
        },
      ],
    });

    const res = await messagingGetConversationThreadTool.handler(
      {
        threadId: '+233244123456',
        limit: 10,
      },
      mockContext
    );

    expect(res.success).toBe(true);
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0].body).toBe('Hello via phone');
    expect(mockWhere).toHaveBeenCalledWith('recipient', '==', '+233244123456');
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('declares 64-char schemaHash and low_risk tier on suggest_reply', () => {
    expect(messagingSuggestReplyTool.riskLevel).toBe('low_risk');
    expect(messagingSuggestReplyTool.name).toBe('messaging.suggest_reply');
    expect(messagingSuggestReplyTool.category).toBe('campaign');
    expect(messagingSuggestReplyTool.requiresApproval).toBe(false);
    expect(messagingSuggestReplyTool.schemaHash).toHaveLength(64);
    expect(messagingSuggestReplyTool.schemaHash).toBe(
      '8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c'
    );
  });

  it('generates formal tone response suggestion without auto-dispatching', async () => {
    const res = await messagingSuggestReplyTool.handler(
      {
        threadId: 't1',
        contactName: 'Mrs. Mensah',
        lastMessage: 'When is the report due?',
        tone: 'formal',
      },
      mockContext
    );

    expect(res.success).toBe(true);
    expect(res.suggestedReply).toContain('Dear Mrs. Mensah,');
    expect(res.suggestedReply).toContain('utmost priority');
    expect(res.toneUsed).toBe('formal');
  });

  it('generates tone-adapted variations for friendly, urgent, and concise', async () => {
    // Friendly (default when omitted)
    const friendlyRes = await messagingSuggestReplyTool.handler(
      {
        threadId: 't1',
        contactName: 'Kofi',
        lastMessage: 'Need help with login',
      },
      mockContext
    );
    expect(friendlyRes.toneUsed).toBe('friendly');
    expect(friendlyRes.suggestedReply).toContain('Hello Kofi,');

    // Urgent
    const urgentRes = await messagingSuggestReplyTool.handler(
      {
        threadId: 't1',
        contactName: 'Principal Darko',
        lastMessage: 'Server offline',
        tone: 'urgent',
      },
      mockContext
    );
    expect(urgentRes.toneUsed).toBe('urgent');
    expect(urgentRes.suggestedReply).toContain('Urgent Notice for Principal Darko:');
    expect(urgentRes.suggestedReply).toContain('immediate action');

    // Concise
    const conciseRes = await messagingSuggestReplyTool.handler(
      {
        threadId: 't1',
        lastMessage: 'Confirm fee schedule',
        tone: 'concise',
      },
      mockContext
    );
    expect(conciseRes.toneUsed).toBe('concise');
    expect(conciseRes.suggestedReply).toContain('Action is underway');
  });

  it('enforces fail-closed multi-tenancy if context is missing workspaceId or organizationId', async () => {
    const badContext = { ...mockContext, workspaceId: '' };

    await expect(
      messagingGetConversationThreadTool.handler({ threadId: 't1' }, badContext)
    ).rejects.toThrow(/missing required workspaceId or organizationId/i);

    await expect(
      messagingSuggestReplyTool.handler(
        { threadId: 't1', lastMessage: 'Hello' },
        badContext
      )
    ).rejects.toThrow(/missing required workspaceId or organizationId/i);
  });
});
