import { describe, it, expect } from 'vitest';

function appendEntityParams(resolvedLink: string, workspaceEntity: { entityId?: string; id: string; primaryEmail?: string; primaryPhone?: string; displayName?: string }) {
    const hasQuery = resolvedLink.includes('?');
    const params = new URLSearchParams();
    params.set('contactId', workspaceEntity.entityId || workspaceEntity.id);
    if (workspaceEntity.primaryEmail) params.set('email', workspaceEntity.primaryEmail);
    if (workspaceEntity.primaryPhone) params.set('phone', workspaceEntity.primaryPhone);
    if (workspaceEntity.displayName) params.set('name', workspaceEntity.displayName);
    
    return `${resolvedLink}${hasQuery ? '&' : '?'}${params.toString()}`;
}

describe('Survey Results Button Utilities', () => {
    it('appends entity details as query string parameter to external target links', () => {
        const targetLink = 'https://example.com/onboarding';
        const contact = {
            id: 'entity-123',
            entityId: 'lead-555',
            displayName: 'John Doe',
            primaryEmail: 'john.doe@example.com',
            primaryPhone: '+15551234'
        };

        const result = appendEntityParams(targetLink, contact);
        
        expect(result).toContain('https://example.com/onboarding?');
        expect(result).toContain('contactId=lead-555');
        expect(result).toContain('email=john.doe%40example.com');
        expect(result).toContain('phone=%2B15551234');
        expect(result).toContain('name=John+Doe');
    });

    it('retains existing parameters when appending entity details', () => {
        const targetLink = 'https://example.com/onboarding?ref=survey';
        const contact = {
            id: 'entity-123',
            displayName: 'John Doe'
        };

        const result = appendEntityParams(targetLink, contact);
        
        expect(result).toBe('https://example.com/onboarding?ref=survey&contactId=entity-123&name=John+Doe');
    });
});
