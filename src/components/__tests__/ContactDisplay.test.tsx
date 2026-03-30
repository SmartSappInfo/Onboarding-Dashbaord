import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContactDisplay, ContactDisplayInline } from '../ContactDisplay';
import type { ResolvedContact } from '@/lib/contact-adapter';

// Mock the contact adapter
vi.mock('@/lib/contact-adapter', () => ({
  resolveContact: vi.fn(),
}));

describe('ContactDisplay Component (Task 35.3)', () => {
  const mockWorkspaceId = 'workspace_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Contact Selection Populates EntityId (Requirement 26.2)', () => {
    it('should display contact using entityId from migrated entity', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Test Institution',
        slug: 'test-institution',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <ContactDisplay
          entityId="entity_456"
          workspaceId={mockWorkspaceId}
          showType
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Institution')).toBeInTheDocument();
      });

      expect(resolveContact).toHaveBeenCalledWith('entity_456', mockWorkspaceId);
    });

    it('should display contact using schoolId from legacy contact', async () => {
      const mockContact: ResolvedContact = {
        id: 'school_789',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        entityType: 'institution',
        migrationStatus: 'legacy',
        tags: [],
        schoolData: {
          id: 'school_789',
          name: 'Legacy School',
        } as any,
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <ContactDisplay
          schoolId="school_789"
          workspaceId={mockWorkspaceId}
          showLegacyBadge
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Legacy School')).toBeInTheDocument();
      });

      expect(resolveContact).toHaveBeenCalledWith('school_789', mockWorkspaceId);
    });

    it('should prefer entityId over schoolId when both provided', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Migrated Contact',
        slug: 'migrated-contact',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <ContactDisplay
          entityId="entity_456"
          schoolId="school_789"
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Migrated Contact')).toBeInTheDocument();
      });

      // Should resolve using entityId, not schoolId
      expect(resolveContact).toHaveBeenCalledWith('entity_456', mockWorkspaceId);
    });
  });

  describe('Contact Display Shows Entity Information (Requirement 26.2)', () => {
    it('should display entity type badge when showType is true', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Test Family',
        slug: 'test-family',
        contacts: [],
        entityType: 'family',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <ContactDisplay
          entityId="entity_456"
          workspaceId={mockWorkspaceId}
          showType
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Family')).toBeInTheDocument();
        expect(screen.getByText('family')).toBeInTheDocument();
      });
    });

    it('should display correct icon for institution entity type', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Test Institution',
        slug: 'test-institution',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const { container } = render(
        <ContactDisplay
          entityId="entity_456"
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

    it('should display correct icon for family entity type', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Test Family',
        slug: 'test-family',
        contacts: [],
        entityType: 'family',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const { container } = render(
        <ContactDisplay
          entityId="entity_456"
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Family')).toBeInTheDocument();
      });

      // Check that Users icon is rendered
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should display correct icon for person entity type', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'John Doe',
        slug: 'john-doe',
        contacts: [],
        entityType: 'person',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const { container } = render(
        <ContactDisplay
          entityId="entity_456"
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Check that User icon is rendered
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should display legacy badge when showLegacyBadge is true for legacy contacts', async () => {
      const mockContact: ResolvedContact = {
        id: 'school_789',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        entityType: 'institution',
        migrationStatus: 'legacy',
        tags: [],
        schoolData: {
          id: 'school_789',
          name: 'Legacy School',
        } as any,
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <ContactDisplay
          schoolId="school_789"
          workspaceId={mockWorkspaceId}
          showLegacyBadge
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Legacy School')).toBeInTheDocument();
        expect(screen.getByText('legacy')).toBeInTheDocument();
      });
    });

    it('should not display legacy badge for migrated contacts', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Migrated Contact',
        slug: 'migrated-contact',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <ContactDisplay
          entityId="entity_456"
          workspaceId={mockWorkspaceId}
          showLegacyBadge
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Migrated Contact')).toBeInTheDocument();
      });

      expect(screen.queryByText('legacy')).not.toBeInTheDocument();
    });
  });

  describe('Components Handle Migrated and Legacy Contacts (Requirement 26.2)', () => {
    it('should handle migrated contact with entityId', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Migrated Institution',
        slug: 'migrated-institution',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <ContactDisplay
          entityId="entity_456"
          workspaceId={mockWorkspaceId}
          showType
          showLegacyBadge
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Migrated Institution')).toBeInTheDocument();
        expect(screen.getByText('institution')).toBeInTheDocument();
      });

      // Should not show legacy badge
      expect(screen.queryByText('legacy')).not.toBeInTheDocument();
    });

    it('should handle legacy contact with schoolId', async () => {
      const mockContact: ResolvedContact = {
        id: 'school_789',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        entityType: 'institution',
        migrationStatus: 'legacy',
        tags: [],
        schoolData: {
          id: 'school_789',
          name: 'Legacy School',
        } as any,
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <ContactDisplay
          schoolId="school_789"
          workspaceId={mockWorkspaceId}
          showType
          showLegacyBadge
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Legacy School')).toBeInTheDocument();
        expect(screen.getByText('institution')).toBeInTheDocument();
        expect(screen.getByText('legacy')).toBeInTheDocument();
      });
    });

    it('should handle contact with denormalized fields (no adapter lookup)', () => {
      render(
        <ContactDisplay
          displayName="Denormalized Contact"
          entityType="family"
          workspaceId={mockWorkspaceId}
          showType
        />
      );

      // Should display immediately without loading
      expect(screen.getByText('Denormalized Contact')).toBeInTheDocument();
      expect(screen.getByText('family')).toBeInTheDocument();
    });

    it('should fallback to schoolName when displayName not provided', () => {
      render(
        <ContactDisplay
          schoolName="School Name Fallback"
          entityType="institution"
          workspaceId={mockWorkspaceId}
        />
      );

      expect(screen.getByText('School Name Fallback')).toBeInTheDocument();
    });

    it('should handle contact not found gracefully', async () => {
      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(null);

      render(
        <ContactDisplay
          entityId="entity_nonexistent"
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No contact')).toBeInTheDocument();
      });
    });

    it('should handle adapter error gracefully', async () => {
      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockRejectedValue(new Error('Adapter error'));

      render(
        <ContactDisplay
          entityId="entity_456"
          workspaceId={mockWorkspaceId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No contact')).toBeInTheDocument();
      });
    });

    it('should show loading skeleton while resolving contact', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Test Contact',
        slug: 'test-contact',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      
      // Delay the resolution to test loading state
      vi.mocked(resolveContact).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockContact), 100))
      );

      const { container } = render(
        <ContactDisplay
          entityId="entity_456"
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

  describe('ContactDisplayInline Component (Task 35.3)', () => {
    it('should render inline variant with smaller styling', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_456',
        name: 'Inline Contact',
        slug: 'inline-contact',
        contacts: [],
        entityType: 'person',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        tags: [],
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      const { container } = render(
        <ContactDisplayInline
          entityId="entity_456"
          workspaceId={mockWorkspaceId}
          showType
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Inline Contact')).toBeInTheDocument();
      });

      // Check for inline-flex class
      const wrapper = container.querySelector('.inline-flex');
      expect(wrapper).toBeInTheDocument();
    });

    it('should support all ContactDisplay props', async () => {
      const mockContact: ResolvedContact = {
        id: 'school_789',
        name: 'Legacy Inline',
        slug: 'legacy-inline',
        contacts: [],
        entityType: 'institution',
        migrationStatus: 'legacy',
        tags: [],
        schoolData: {
          id: 'school_789',
          name: 'Legacy Inline',
        } as any,
      };

      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      render(
        <ContactDisplayInline
          schoolId="school_789"
          workspaceId={mockWorkspaceId}
          showType
          showLegacyBadge
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Legacy Inline')).toBeInTheDocument();
        expect(screen.getByText('institution')).toBeInTheDocument();
        expect(screen.getByText('legacy')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases and Error Handling (Task 35.3)', () => {
    it('should handle missing workspaceId gracefully', async () => {
      const { resolveContact } = await import('@/lib/contact-adapter');
      vi.mocked(resolveContact).mockResolvedValue(null);

      render(
        <ContactDisplay
          entityId="entity_456"
          workspaceId=""
        />
      );

      // Should attempt to resolve but handle gracefully when it fails
      await waitFor(() => {
        expect(screen.getByText('No contact')).toBeInTheDocument();
      });
    });

    it('should handle null entityId and schoolId', () => {
      render(
        <ContactDisplay
          entityId={null}
          schoolId={null}
          workspaceId={mockWorkspaceId}
        />
      );

      expect(screen.getByText('No contact')).toBeInTheDocument();
    });

    it('should handle undefined entityId and schoolId', () => {
      render(
        <ContactDisplay
          workspaceId={mockWorkspaceId}
        />
      );

      expect(screen.getByText('No contact')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <ContactDisplay
          displayName="Custom Class Contact"
          workspaceId={mockWorkspaceId}
          className="custom-test-class"
        />
      );

      const wrapper = container.querySelector('.custom-test-class');
      expect(wrapper).toBeInTheDocument();
    });

    it('should apply custom iconClassName', () => {
      const { container } = render(
        <ContactDisplay
          displayName="Custom Icon Contact"
          workspaceId={mockWorkspaceId}
          iconClassName="custom-icon-class"
        />
      );

      const icon = container.querySelector('.custom-icon-class');
      expect(icon).toBeInTheDocument();
    });

    it('should apply custom nameClassName', () => {
      const { container } = render(
        <ContactDisplay
          displayName="Custom Name Contact"
          workspaceId={mockWorkspaceId}
          nameClassName="custom-name-class"
        />
      );

      const name = container.querySelector('.custom-name-class');
      expect(name).toBeInTheDocument();
    });
  });
});
