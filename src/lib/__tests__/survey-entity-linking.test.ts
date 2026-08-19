import { describe, it, expect, vi } from 'vitest';
import { resolveOrMatchWorkspaceEntity, sanitizeEntityPayloadForUpdate } from '@/lib/survey-actions';

vi.mock('@/lib/firebase-admin', () => {
  const mockGet = vi.fn().mockResolvedValue({ empty: true, docs: [] });
  const mockLimit = vi.fn(() => ({ get: mockGet }));
  const mockWhere = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: mockLimit,
    }),
    limit: mockLimit,
  });

  return {
    adminDb: {
      collection: vi.fn((collName: string) => {
        if (collName === 'workspace_entities') {
          return {
            where: mockWhere,
            limit: mockLimit,
          };
        }
        if (collName === 'entities') {
          return {
            doc: vi.fn((docId: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: docId === 'ent_existing_123',
                id: docId,
                data: () => ({
                  name: 'Kofi Annan Institute',
                  workspaceIds: ['ws_test_123'],
                  entityContacts: [
                    {
                      name: 'Staff Member',
                      email: 'staff@kofiannan.edu',
                      phone: '+233240001111',
                    },
                  ],
                }),
              }),
            })),
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  docs: [
                    {
                      id: 'ent_existing_123',
                      data: () => ({
                        name: 'Kofi Annan Institute',
                        workspaceIds: ['ws_test_123'],
                        entityContacts: [
                          {
                            name: 'Staff Member',
                            email: 'staff@kofiannan.edu',
                            phone: '+233240001111',
                          },
                        ],
                      }),
                    },
                  ],
                }),
              }),
            }),
          };
        }
        return {
          doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false }) })),
          where: vi.fn().mockReturnThis(),
        };
      }),
    },
  };
});

describe('Survey Entity Deduplication & Recognition Engine', () => {
  const workspaceId = 'ws_test_123';

  it('matches entity directly via preTrackedEntityId in entities collection', async () => {
    const result = await resolveOrMatchWorkspaceEntity(workspaceId, {
      preTrackedEntityId: 'ent_existing_123',
      email: 'someone_else@other.org',
    });

    expect(result).not.toBeNull();
    expect(result?.entityId).toBe('ent_existing_123');
    expect(result?.entityName).toBe('Kofi Annan Institute');
    expect(result?.matchedBy).toBe('tracked_id');
  });

  it('matches entity via secondary contact email in entities collection', async () => {
    const result = await resolveOrMatchWorkspaceEntity(workspaceId, {
      email: 'staff@kofiannan.edu',
    });

    expect(result).not.toBeNull();
    expect(result?.entityId).toBe('ent_existing_123');
    expect(result?.matchedBy).toBe('contact_email');
  });

  it('returns null when workspaceId is missing', async () => {
    const result = await resolveOrMatchWorkspaceEntity('', {
      email: 'test@example.com',
    });

    expect(result).toBeNull();
  });
});

describe('sanitizeEntityPayloadForUpdate (Identity Protection)', () => {
  it('strips name update when updating existing entity without explicit mapping', async () => {
    const payload = {
      name: 'John Doe',
      globalTags: [],
      workspaceTags: [],
    };

    const sanitized = await sanitizeEntityPayloadForUpdate(payload, {
      isExistingEntity: true,
      isExplicitlyMapped: false,
      isManualInput: false,
      existingEntityName: 'Kofi Annan Institute',
    });

    expect(sanitized.name).toBeUndefined();
  });

  it('retains name update when field is explicitly mapped to entity.name', async () => {
    const payload = {
      name: 'Kofi Annan International Peacekeeping Centre',
      globalTags: [],
      workspaceTags: [],
    };

    const sanitized = await sanitizeEntityPayloadForUpdate(payload, {
      isExistingEntity: true,
      isExplicitlyMapped: true,
      isManualInput: false,
      existingEntityName: 'Kofi Annan Institute',
    });

    expect(sanitized.name).toBe('Kofi Annan International Peacekeeping Centre');
  });

  it('retains name update when user manually typed company name in lead form', async () => {
    const payload = {
      name: 'New School Branch',
      globalTags: [],
      workspaceTags: [],
    };

    const sanitized = await sanitizeEntityPayloadForUpdate(payload, {
      isExistingEntity: true,
      isExplicitlyMapped: false,
      isManualInput: true,
      existingEntityName: 'Old School Name',
    });

    expect(sanitized.name).toBe('New School Branch');
  });

  it('allows updating placeholder or generic choice names', async () => {
    const payload = {
      name: 'Kofi Annan Institute',
      globalTags: [],
      workspaceTags: [],
    };

    const sanitized = await sanitizeEntityPayloadForUpdate(payload, {
      isExistingEntity: true,
      isExplicitlyMapped: false,
      isManualInput: false,
      existingEntityName: '[Placeholder] admin@school.edu',
    });

    expect(sanitized.name).toBe('Kofi Annan Institute');
  });
});
