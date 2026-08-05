import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendWhatsApp } from '../whatsapp/whatsapp-send';

const mockGetCredentials = vi.fn();
const mockGetTemplate = vi.fn();
const mockSendMessage = vi.fn();

vi.mock('../whatsapp/whatsapp-credential-repository', () => ({
  WhatsAppCredentialRepository: {
    getCredentials: (...args: any[]) => mockGetCredentials(...args),
  },
}));

vi.mock('../whatsapp/whatsapp-template-repository', () => ({
  WhatsAppTemplateRepository: {
    get: (...args: any[]) => mockGetTemplate(...args),
  },
}));

vi.mock('../whatsapp/meta-cloud-client', () => ({
  MetaCloudApiClient: vi.fn().mockImplementation(() => ({
    sendMessage: (...args: any[]) => mockSendMessage(...args),
  })),
}));

const mockDocGet = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: () => mockDocGet(),
      }),
    }),
  },
}));

describe('sendWhatsApp Engine Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully dispatches a direct text message inside an active 24h session window without template', async () => {
    mockGetCredentials.mockResolvedValueOnce({
      accessToken: 'test-token',
      phoneNumberId: '123456',
      wabaId: 'waba-123',
      organizationId: 'org-1',
    });

    // Mock open 24h session
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ lastInboundAt: new Date().toISOString() }),
    });

    mockSendMessage.mockResolvedValueOnce({
      metaMessageId: 'wamid.HBgLMTIzNDU2Nzg5MA==',
    });

    const result = await sendWhatsApp({
      organizationId: 'org-1',
      recipient: '+233241234567',
      resolvedBody: 'Direct hello inside 24h window',
      variables: {},
    });

    expect(result.metaMessageId).toBe('wamid.HBgLMTIzNDU2Nzg5MA==');
    expect(result.status).toBe('sent');
    expect(mockSendMessage).toHaveBeenCalledWith({
      messaging_product: 'whatsapp',
      to: '233241234567',
      type: 'text',
      text: { body: 'Direct hello inside 24h window' },
    });
  });

  it('rejects a direct text message outside the 24h session window when no template is provided', async () => {
    mockGetCredentials.mockResolvedValueOnce({
      accessToken: 'test-token',
      phoneNumberId: '123456',
      wabaId: 'waba-123',
      organizationId: 'org-1',
    });

    // Mock closed session (no inbound)
    mockDocGet.mockResolvedValueOnce({
      exists: false,
    });

    await expect(
      sendWhatsApp({
        organizationId: 'org-1',
        recipient: '+233241234567',
        resolvedBody: 'Direct message to cold contact',
      })
    ).rejects.toThrow('WhatsApp requires an approved template outside the 24-hour customer-service window.');
  });
});
