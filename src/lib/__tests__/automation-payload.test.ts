import { describe, it, expect } from 'vitest';
import { buildAutomationPayload } from '../automation-payload';

describe('buildAutomationPayload (P5-5)', () => {
  it('returns entity-first contract fields', () => {
    const payload = buildAutomationPayload({
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      entityId: 'ent-1',
      entityType: 'institution',
      action: 'entity_created',
      actorId: 'user-1',
      metadata: { tagId: 'tag-1' },
    });

    expect(payload).toMatchObject({
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      entityId: 'ent-1',
      entityType: 'institution',
      action: 'entity_created',
      actorId: 'user-1',
      tagId: 'tag-1',
    });
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('defaults empty entityId and institution entityType', () => {
    const payload = buildAutomationPayload({
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      action: 'tag_added',
      actorId: null,
    });

    expect(payload.entityId).toBe('');
    expect(payload.entityType).toBe('institution');
    expect(payload.actorId).toBeNull();
  });
});
