import { describe, it, expect, vi } from 'vitest';
import {
  messagingGetConversationThreadTool,
  messagingSuggestReplyTool,
} from '../messaging-conversation-tools';
import type { McpExecutionContext } from '../../types';

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
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
      }),
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

  it('declares read_only risk tier on get_conversation_thread', () => {
    expect(messagingGetConversationThreadTool.riskLevel).toBe('read_only');
    expect(messagingGetConversationThreadTool.name).toBe('messaging.get_conversation_thread');
    expect(messagingGetConversationThreadTool.category).toBe('campaign');
    expect(messagingGetConversationThreadTool.requiresApproval).toBe(false);
  });

  it('retrieves chronological messages for a conversation thread', async () => {
    const res = await messagingGetConversationThreadTool.handler(
      {
        threadId: 't1',
        limit: 20,
      },
      mockContext
    );

    expect(res.success).toBe(true);
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0].body).toBe('When is the report due?');
  });

  it('declares low_risk tier on suggest_reply and generates response suggestion without auto-dispatching', async () => {
    expect(messagingSuggestReplyTool.riskLevel).toBe('low_risk');
    expect(messagingSuggestReplyTool.name).toBe('messaging.suggest_reply');
    expect(messagingSuggestReplyTool.category).toBe('campaign');
    expect(messagingSuggestReplyTool.requiresApproval).toBe(false);

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
    expect(res.suggestedReply).toContain('Mrs. Mensah');
    expect(res.suggestedReply).toContain('report');
    expect(res.toneUsed).toBe('formal');
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
