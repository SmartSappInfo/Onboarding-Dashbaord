import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDirectMessage } from '../automations/actions/message-actions';
import type { ExecutionContext } from '../automations/execution-types';

const mockSendRawMessage = vi.fn().mockResolvedValue({ success: true });
const mockResolveContact = vi.fn();
const mockBuildVariableMap = vi.fn().mockResolvedValue({
  brand_primary_color: '#3B5FFF',
  organization_name: 'SmartSapp Test Org',
  org_logo_url: 'https://logo.url/logo.png',
  unsubscribe_copy: 'Test Unsubscribe',
});
const mockRenderTemplate = vi.fn((body: string, vars: Record<string, unknown>) => {
  let rendered = body;
  for (const [k, v] of Object.entries(vars)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  return rendered;
});

vi.mock('../messaging-engine', () => ({
  sendRawMessage: (args: Record<string, unknown>) => mockSendRawMessage(args),
}));

vi.mock('../contact-adapter', () => ({
  resolveContact: (id: string, wsId: string) => mockResolveContact(id, wsId),
}));

vi.mock('../template-resolver', () => ({
  buildVariableMap: (contextType: string, ctx: Record<string, unknown>) => mockBuildVariableMap(contextType, ctx),
}));

vi.mock('../template-utils', () => ({
  renderTemplate: (body: string, variables: Record<string, unknown>) => mockRenderTemplate(body, variables),
}));

describe('Direct SMS and Email Automation Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully execute DIRECT_SMS to fixed recipient', async () => {
    const config = {
      recipientTargets: ['fixed'],
      recipient: '+233240000000',
      directBody: 'Hello {{name}}',
      senderProfileId: 'sms-profile-1',
    };
    
    const context: ExecutionContext = {
      automationId: 'auto-1',
      runId: 'run-1',
      workspaceId: 'ws-1',
      entityId: 'ent-1',
      entityType: 'institution',
      payload: { name: 'John Doe' },
    };

    mockBuildVariableMap.mockResolvedValueOnce({
      name: 'John Doe',
    });

    await handleDirectMessage('DIRECT_SMS', config, context);

    expect(mockBuildVariableMap).toHaveBeenCalledWith('common', {
      entityId: 'ent-1',
      workspaceId: 'ws-1',
      extraVars: { name: 'John Doe' },
    });

    expect(mockSendRawMessage).toHaveBeenCalledWith({
      channel: 'sms',
      recipient: '+233240000000',
      body: 'Hello John Doe',
      senderProfileId: 'sms-profile-1',
      variables: { name: 'John Doe' },
      workspaceIds: ['ws-1'],
      messageType: 'transactional',
      entityId: 'ent-1',
      entityType: 'institution',
      isAutomation: true
    });
  });

  it('should successfully execute DIRECT_EMAIL to fixed recipient and wrap in brand layout', async () => {
    const config = {
      recipientTargets: ['fixed'],
      recipient: 'john@example.com',
      directSubject: 'Alert for {{name}}',
      directBody: 'Hello {{name}} from SmartSapp',
      senderProfileId: 'email-profile-1',
      useBrandLayout: true,
    };
    
    const context: ExecutionContext = {
      automationId: 'auto-1',
      runId: 'run-1',
      workspaceId: 'ws-1',
      entityId: 'ent-1',
      entityType: 'institution',
      payload: { name: 'John Doe' },
    };

    mockBuildVariableMap.mockResolvedValueOnce({
      name: 'John Doe',
      brand_primary_color: '#3B5FFF',
      organization_name: 'SmartSapp Test Org',
      org_logo_url: 'https://logo.url/logo.png',
      unsubscribe_copy: 'Test Unsubscribe',
    });

    await handleDirectMessage('DIRECT_EMAIL', config, context);

    expect(mockSendRawMessage).toHaveBeenCalled();
    const callArgs = mockSendRawMessage.mock.calls[0][0] as Record<string, unknown>;

    expect(callArgs.channel).toBe('email');
    expect(callArgs.recipient).toBe('john@example.com');
    expect(callArgs.subject).toBe('Alert for John Doe');
    expect(callArgs.senderProfileId).toBe('email-profile-1');
    expect(callArgs.isAutomation).toBe(true);

    // Verify HTML wrapper components exist in final email body
    const bodyStr = String(callArgs.body);
    expect(bodyStr).toContain('<!DOCTYPE html>');
    expect(bodyStr).toContain('SmartSapp Test Org');
    expect(bodyStr).toContain('https://logo.url/logo.png');
    expect(bodyStr).toContain('Hello John Doe from SmartSapp');
    expect(bodyStr).toContain('Test Unsubscribe');
  });
});
