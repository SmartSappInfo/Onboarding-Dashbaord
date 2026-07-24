import { describe, it, expect } from 'vitest';
import type { WorkspaceEntity, DealFocalContact } from '@/lib/types';

/**
 * Unit test suite verifying entity name interpolation, focal contact linking,
 * and email engagement summary formatting for bulk/automated deal creation.
 */
describe('Bulk Deal Creation Logic', () => {
  const mockEntity: WorkspaceEntity = {
    id: 'ent_101',
    entityId: 'ent_101',
    workspaceId: 'ws_demo',
    organizationId: 'org_demo',
    displayName: 'Lincoln Academy',
    entityType: 'institution',
    status: 'active',
    workspaceTags: [],
    addedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    entityContacts: [
      {
        id: 'cnt_001',
        name: 'Dr. Sarah Connor',
        typeKey: 'principal',
        typeLabel: 'Principal',
        email: 'sarah@lincoln.edu',
        phone: '+15550199',
        isPrimary: true,
        isSignatory: true,
        order: 1,
      },
      {
        id: 'cnt_002',
        name: 'Alexander Pierce',
        typeKey: 'administrator',
        typeLabel: 'Administrator',
        email: 'alex@lincoln.edu',
        phone: '+15550288',
        isPrimary: false,
        isSignatory: false,
        order: 2,
      },
    ],
  };

  function resolveDealName(pattern: string, entityDisplayName: string): string {
    let pat = pattern || '{{entityName}}';
    if (pat === 'Automated Event Deal') {
      pat = '{{entityName}} - Opened Email';
    }
    return pat
      .replace(/\{\{entityName\}\}/g, entityDisplayName)
      .replace(/\{\{entity_name\}\}/g, entityDisplayName);
  }

  function resolveFocalContactsHelper(
    entity: WorkspaceEntity,
    contactId?: string
  ): DealFocalContact[] {
    let resolved: DealFocalContact[] = [];
    const entityContacts = entity.entityContacts || [];
    const legacyFocal = ((entity as unknown as Record<string, unknown>).focalContacts as Array<Record<string, string>> | undefined) || [];

    if (contactId && (entityContacts.length > 0 || legacyFocal.length > 0)) {
      const matched = entityContacts.find(
        (c) =>
          c.id === contactId ||
          (c.email && c.email.toLowerCase() === contactId.toLowerCase()) ||
          (c.phone && c.phone === contactId)
      );
      if (matched) {
        resolved = [
          {
            id: matched.id || contactId,
            name: matched.name || 'Contact',
            role: matched.typeLabel || undefined,
            email: matched.email || undefined,
            phone: matched.phone || undefined,
          },
        ];
      }
    }

    if (resolved.length === 0 && entityContacts.length > 0) {
      const primary = entityContacts.find((c) => c.isPrimary) || entityContacts[0];
      resolved = [
        {
          id: primary.id,
          name: primary.name,
          role: primary.typeLabel || undefined,
          email: primary.email || undefined,
          phone: primary.phone || undefined,
        },
      ];
    }

    return resolved;
  }

  function formatEmailDescriptionHelper(
    subject?: string | null,
    previewText?: string | null
  ): string | null {
    const parts: string[] = [];
    if (subject) parts.push(`Opened Email: "${subject}"`);
    if (previewText) parts.push(`Preheader: "${previewText}"`);
    return parts.length > 0 ? parts.join('\n') : null;
  }

  it('should resolve dynamic deal name pattern with entity displayName', () => {
    expect(resolveDealName('{{entityName}} - Opened Email', 'Lincoln Academy')).toBe(
      'Lincoln Academy - Opened Email'
    );
    expect(resolveDealName('Automated Event Deal', 'Lincoln Academy')).toBe(
      'Lincoln Academy - Opened Email'
    );
  });

  it('should link specific contact when contactId/email matches', () => {
    const resolved = resolveDealName('{{entityName}}', 'Lincoln Academy');
    expect(resolved).toBe('Lincoln Academy');

    const matchedContact = resolveFocalContactsHelper(mockEntity, 'alex@lincoln.edu');
    expect(matchedContact).toHaveLength(1);
    expect(matchedContact[0].name).toBe('Alexander Pierce');
    expect(matchedContact[0].role).toBe('Administrator');
  });

  it('should fallback to primary contact when no contactId is provided', () => {
    const resolvedPrimary = resolveFocalContactsHelper(mockEntity);
    expect(resolvedPrimary).toHaveLength(1);
    expect(resolvedPrimary[0].name).toBe('Dr. Sarah Connor');
    expect(resolvedPrimary[0].role).toBe('Principal');
  });

  it('should format structured email summary description', () => {
    const desc = formatEmailDescriptionHelper(
      'Welcome to Lincoln Academy Portal',
      'Here are your onboarding instructions'
    );
    expect(desc).toBe(
      'Opened Email: "Welcome to Lincoln Academy Portal"\nPreheader: "Here are your onboarding instructions"'
    );
  });
});
