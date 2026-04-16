import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageContactDisplay } from '../MessageContactDisplay';
import type { MessageLog } from '@/lib/types';
import type { ResolvedContact } from '@/lib/contact-adapter';

// Mock the contact adapter
vi.mock('@/lib/contact-adapter', () => ({
  resolveContact: vi.fn(),
}));

describe('MessageContactDisplay Component (Task 35.3)', () => {
  const mockWorkspaceId = 'workspace_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Contact Display Shows Entity Information (Requirement 26.2)', () => {
    it('should display contact from migrated entity using entityId', async () => {
      const mockLog: MessageLog = {
        id: 'msg_1',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'entity_456',
        entityType: 'institution',
        channel: 'email',
        recipient: 'test@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {}
      };

      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Test Institution',
        slug: 'test-institution',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
        entityContacts: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Institution')).toBeInTheDocument();
        expect(screen.getByText('institution')).toBeInTheDocument();
      });

      expect(resolveContact).toHaveBeenCalledWith('entity_456', mockWorkspaceId);
    });

    it('should display contact from legacy school using entityId', async () => {
      const mockLog: MessageLog = {
        id: 'msg_2',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'school_789',
        entityName: 'Legacy School',
        channel: 'email',
        recipient: 'legacy@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {}
      };

      const mockContact: ResolvedContact = {
        id: 'school_789',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        entityType: 'institution',
        migrationStatus: 'legacy',
        tags: [],
        entityContacts: [],
        schoolData: {
          id: 'school_789',
          name: 'Legacy School',
        } as any,
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Legacy School')).toBeInTheDocument();
        expect(screen.getByText('legacy')).toBeInTheDocument();
      });

      expect(resolveContact).toHaveBeenCalledWith('school_789', mockWorkspaceId);
    });

    it('should prefer entityId over entityId when both present', async () => {
      const mockLog: MessageLog = {
        id: 'msg_3',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'school_789',
        entityType: 'institution',
        channel: 'email',
        recipient: 'test@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {}
      };

      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Migrated Contact',
        slug: 'migrated-contact',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
        entityContacts: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Migrated Contact')).toBeInTheDocument();
      });

      // Should use entityId, not entityId
      expect(resolveContact).toHaveBeenCalledWith('entity_456', mockWorkspaceId);
    });

    it('should display entity type badge for family', async () => {
      const mockLog: MessageLog = {
        id: 'msg_4',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'entity_456',
        entityType: 'family',
        channel: 'email',
        recipient: 'family@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {},
      };

      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Test Family',
        slug: 'test-family',
        contacts: [],
        entityType: 'family',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
        entityContacts: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Family')).toBeInTheDocument();
        expect(screen.getByText('family')).toBeInTheDocument();
      });
    });

    it('should display entity type badge for person', async () => {
      const mockLog: MessageLog = {
        id: 'msg_5',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'entity_456',
        entityType: 'person',
        channel: 'email',
        recipient: 'person@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {},
      };

      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'John Doe',
        slug: 'john-doe',
        contacts: [],
        entityType: 'person',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
        entityContacts: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('person')).toBeInTheDocument();
      });
    });

    it('should display correct icon for institution entity type', async () => {
      const mockLog: MessageLog = {
        id: 'msg_6',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'entity_456',
        entityType: 'institution',
        channel: 'email',
        recipient: 'test@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {},
      };

      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Test Institution',
        slug: 'test-institution',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
        entityContacts: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const { container } = render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Institution')).toBeInTheDocument();
      });

      // Check that Building icon is rendered (Lucide icons render as SVG)
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Components Handle Migrated and Legacy Contacts (Requirement 26.2)', () => {
    it('should handle migrated contact without legacy badge', async () => {
      const mockLog: MessageLog = {
        id: 'msg_7',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'entity_456',
        entityType: 'institution',
        channel: 'email',
        recipient: 'test@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {},
      };

      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Migrated Institution',
        slug: 'migrated-institution',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
        entityContacts: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Migrated Institution')).toBeInTheDocument();
      });

      // Should not show legacy badge
      expect(screen.queryByText('legacy')).not.toBeInTheDocument();
    });

    it('should handle legacy contact with legacy badge', async () => {
      const mockLog: MessageLog = {
        id: 'msg_8',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'school_789',
        entityName: 'Legacy School',
        channel: 'email',
        recipient: 'legacy@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {}
      };

      const mockContact: ResolvedContact = {
        id: 'school_789',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        entityType: 'institution',
        migrationStatus: 'legacy',
        tags: [],
        entityContacts: [],
        schoolData: {
          id: 'school_789',
          name: 'Legacy School',
        } as any,
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Legacy School')).toBeInTheDocument();
        expect(screen.getByText('legacy')).toBeInTheDocument();
      });
    });

    it('should fallback to denormalized displayName when contact not found', async () => {
      const mockLog: MessageLog = {
        id: 'msg_9',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'entity_nonexistent',
        displayName: 'Denormalized Name',
        entityType: 'institution',
        channel: 'email',
        recipient: 'test@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {},
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(null);

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Denormalized Name')).toBeInTheDocument();
      });
    });

    it('should fallback to entityName when displayName not available', async () => {
      const mockLog: MessageLog = {
        id: 'msg_10',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'school_nonexistent',
        entityName: 'School Name Fallback',
        channel: 'email',
        recipient: 'test@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {}
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(null);

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('School Name Fallback')).toBeInTheDocument();
      });
    });

    it('should handle adapter error gracefully with fallback', async () => {
      const mockLog: MessageLog = {
        id: 'msg_11',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'entity_456',
        displayName: 'Fallback Name',
        entityType: 'institution',
        channel: 'email',
        recipient: 'test@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {},
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockRejectedValue(new Error('Adapter error'));

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Fallback Name')).toBeInTheDocument();
      });
    });

    it('should show "No contact" when no identifier or name available', async () => {
      const mockLog: MessageLog = {
        id: 'msg_12',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        channel: 'email',
        recipient: 'test@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {},
        entityId: null
      };

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No contact')).toBeInTheDocument();
      });
    });

    it('should show loading skeleton while resolving contact', async () => {
      const mockLog: MessageLog = {
        id: 'msg_13',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'entity_456',
        entityType: 'institution',
        channel: 'email',
        recipient: 'test@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {},
      };

      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Test Contact',
        slug: 'test-contact',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
        entityContacts: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      
      // Delay the resolution to test loading state
      vi.mocked(resolveContact).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockContact), 100))
      );

      const { container } = render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      // Should show skeleton initially
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();

      // Wait for contact to resolve
      await waitFor(() => {
        expect(screen.getByText('Test Contact')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases and Error Handling (Task 35.3)', () => {
    it('should handle message log with only entityId', async () => {
      const mockLog: MessageLog = {
        id: 'msg_14',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'entity_456',
        channel: 'email',
        recipient: 'test@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {},
      };

      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Entity Only Contact',
        slug: 'entity-only-contact',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
        entityContacts: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Entity Only Contact')).toBeInTheDocument();
      });
    });

    it('should handle message log with only entityId', async () => {
      const mockLog: MessageLog = {
        id: 'msg_15',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'school_789',
        channel: 'email',
        recipient: 'test@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {}
      };

      const mockContact: ResolvedContact = {
        id: 'school_789',
        name: 'School Only Contact',
        slug: 'school-only-contact',
        contacts: [],
        entityType: 'institution',
        migrationStatus: 'legacy',
        tags: [],
        entityContacts: [],
        schoolData: {
          id: 'school_789',
          name: 'School Only Contact',
        } as any,
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('School Only Contact')).toBeInTheDocument();
      });
    });

    it('should handle null entityId and entityId', async () => {
      const mockLog: MessageLog = {
        id: 'msg_16',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: null,
        channel: 'email',
        recipient: 'test@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {}
      };

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No contact')).toBeInTheDocument();
      });
    });

    it('should handle message log with dual-write (both entityId and entityId)', async () => {
      const mockLog: MessageLog = {
        id: 'msg_17',
        organizationId: 'org_123',
        title: 'Test Message',
        templateId: 'template_1',
        templateName: 'Test Template',
        senderProfileId: 'sender_1',
        senderName: 'Test Sender',
        workspaceId: mockWorkspaceId,
        workspaceIds: [mockWorkspaceId],
        entityId: 'school_789',
        displayName: 'Dual Write Contact',
        entityName: 'Dual Write School',
        entityType: 'institution',
        channel: 'email',
        recipient: 'test@example.com',
        body: 'Test message',
        status: 'sent',
        sentAt: '2024-01-01T00:00:00Z',
        providerId: null,
        providerStatus: null,
        variables: {}
      };

      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Dual Write Contact',
        slug: 'dual-write-contact',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
        entityContacts: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <MessageContactDisplay
          log={mockLog}
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Dual Write Contact')).toBeInTheDocument();
      });

      // Should prefer entityId
      expect(resolveContact).toHaveBeenCalledWith('entity_456', mockWorkspaceId);
    });
  });
});
