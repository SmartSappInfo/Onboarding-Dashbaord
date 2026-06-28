import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockTemplates = new Map<string, Record<string, unknown>>();
const mockProfiles = new Map<string, Record<string, unknown>>();
const mockOrgs = new Map<string, Record<string, unknown>>();
const mockStyles = new Map<string, Record<string, unknown>>();

interface SentEmailArgs {
  to: string;
  subject: string;
  html: string;
  from?: string;
}
const mockSentEmails: SentEmailArgs[] = [];

vi.mock('../../firebase-admin', () => {
  return {
    adminDb: {
      collection: (name: string) => {
        if (name === 'message_templates') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                exists: mockTemplates.has(id),
                id,
                data: () => mockTemplates.get(id)
              })
            })
          };
        }
        if (name === 'sender_profiles') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                exists: mockProfiles.has(id),
                id,
                data: () => mockProfiles.get(id)
              })
            })
          };
        }
        if (name === 'organizations') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                exists: mockOrgs.has(id),
                id,
                data: () => mockOrgs.get(id)
              })
            })
          };
        }
        if (name === 'message_styles') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                exists: mockStyles.has(id),
                id,
                data: () => mockStyles.get(id)
              })
            }),
            where: () => ({
              where: () => ({
                limit: () => ({
                  get: async () => ({
                    empty: true,
                    docs: []
                  })
                })
              })
            })
          };
        }
        return {
          add: async () => {
            return { id: 'new-doc' };
          },
          doc: (id: string) => ({
            id,
            get: async () => ({
              exists: false,
              data: () => undefined
            }),
            set: async () => {},
            update: async () => {}
          })
        };
      }
    }
  };
});

// Mock Resend & mNotify gateway services
vi.mock('../../resend-service', () => ({
  sendEmail: vi.fn().mockImplementation(async (args: SentEmailArgs) => {
    mockSentEmails.push(args);
    return { id: 'resend-123' };
  })
}));
vi.mock('../../mnotify-service', () => ({
  sendSms: vi.fn().mockResolvedValue({ summary: { _id: 'mnotify-123' }, status: 'success' })
}));
vi.mock('../../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../suppression-service', () => ({
  isSuppressed: vi.fn().mockResolvedValue(false)
}));

import { sendMessage } from '../../messaging-engine';
import { sendEmail } from '../../resend-service';

describe('Message Style Footer Overrides', () => {
  beforeEach(() => {
    mockTemplates.clear();
    mockProfiles.clear();
    mockOrgs.clear();
    mockStyles.clear();
    mockSentEmails.length = 0;
    vi.clearAllMocks();

    // Default Org Configuration
    mockOrgs.set('org-x', {
      name: 'Org X',
      logoUrl: 'https://org.logo/default.png',
      footerHtml: '<div class="org-footer">Org Default Footer - {{org_name}}</div>',
      footerEnabled: true,
      defaultSenderProfileIds: { email: 'default-profile' }
    });

    // Default Sender Profile
    mockProfiles.set('default-profile', {
      organizationId: 'org-x',
      name: 'Org X',
      channel: 'email',
      identifier: 'no-reply@orgx.com',
      isDefault: true,
      isActive: true
    });
  });

  it('should override logo and footer when custom values are defined on style', async () => {
    // Setup Style with Custom Logo and Footer
    mockStyles.set('style-all-overrides', {
      name: 'Style with overrides',
      organizationId: 'org-x',
      htmlWrapperExternal: '<html><body>{{content}} {{org_footer}} <img src="{{org_logo_url}}" /></body></html>',
      logoUrl: 'https://custom.logo/style.png',
      footerHtml: '<div class="custom-style-footer">Style Override Footer - {{org_name}}</div>',
      footerEnabled: true
    });

    mockTemplates.set('tmpl-all-overrides', {
      channel: 'email',
      scope: 'organization',
      organizationId: 'org-x',
      category: 'general',
      name: 'Template with All Overrides',
      body: 'Hello {{name}}',
      subject: 'Welcome {{name}}',
      contentMode: 'plain_text',
      styleId: 'style-all-overrides'
    });

    const result = await sendMessage({
      templateId: 'tmpl-all-overrides',
      senderProfileId: 'default-profile',
      recipient: 'test@example.com',
      variables: { name: 'Alice' },
      workspaceId: 'workspace-123'
    });

    expect(result.success).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const sentHtml = mockSentEmails[0].html;

    // Verify logo overridden
    expect(sentHtml).toContain('https://custom.logo/style.png');
    expect(sentHtml).not.toContain('https://org.logo/default.png');

    // Verify footer overridden
    expect(sentHtml).toContain('Style Override Footer - Org X');
    expect(sentHtml).not.toContain('Org Default Footer');
  });

  it('should omit footer when style overrides footerEnabled to false', async () => {
    // Setup Style with Footer Disabled
    mockStyles.set('style-footer-disabled', {
      name: 'Style with footer disabled',
      organizationId: 'org-x',
      htmlWrapperExternal: '<html><body>{{content}} {{org_footer}} <img src="{{org_logo_url}}" /></body></html>',
      logoUrl: 'https://custom.logo/style.png',
      footerEnabled: false
    });

    mockTemplates.set('tmpl-footer-disabled', {
      channel: 'email',
      scope: 'organization',
      organizationId: 'org-x',
      category: 'general',
      name: 'Template with Footer Disabled',
      body: 'Hello {{name}}',
      subject: 'Welcome {{name}}',
      contentMode: 'plain_text',
      styleId: 'style-footer-disabled'
    });

    const result = await sendMessage({
      templateId: 'tmpl-footer-disabled',
      senderProfileId: 'default-profile',
      recipient: 'test@example.com',
      variables: { name: 'Bob' },
      workspaceId: 'workspace-123'
    });

    expect(result.success).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const sentHtml = mockSentEmails[0].html;

    // Footer HTML should be empty string
    expect(sentHtml).not.toContain('Style Override Footer');
    expect(sentHtml).not.toContain('Org Default Footer');
  });

  it('should fallback to organization defaults when style does not define overrides', async () => {
    // Setup Style with No Overrides
    mockStyles.set('style-no-overrides', {
      name: 'Style with no overrides',
      organizationId: 'org-x',
      htmlWrapperExternal: '<html><body>{{content}} {{org_footer}} <img src="{{org_logo_url}}" /></body></html>',
    });

    mockTemplates.set('tmpl-no-overrides', {
      channel: 'email',
      scope: 'organization',
      organizationId: 'org-x',
      category: 'general',
      name: 'Template with No Overrides',
      body: 'Hello {{name}}',
      subject: 'Welcome {{name}}',
      contentMode: 'plain_text',
      styleId: 'style-no-overrides'
    });

    const result = await sendMessage({
      templateId: 'tmpl-no-overrides',
      senderProfileId: 'default-profile',
      recipient: 'test@example.com',
      variables: { name: 'Charlie' },
      workspaceId: 'workspace-123'
    });

    expect(result.success).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const sentHtml = mockSentEmails[0].html;

    // Verify fallbacks to org configuration
    expect(sentHtml).toContain('https://org.logo/default.png');
    expect(sentHtml).toContain('Org Default Footer - Org X');
  });
});
