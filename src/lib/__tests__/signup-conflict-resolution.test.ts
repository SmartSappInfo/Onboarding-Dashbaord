import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkSignupDuplicatesAction, mergeSignupIntoEntityAction } from '../signup-conflict-actions';
import type { SignupInput } from '../signup-actions';

// Mock dependencies
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            displayName: 'Existing School Academy',
            primaryEmail: 'owner@existingschool.com',
            primaryPhone: '+233240001122',
            entityContacts: [
              {
                id: 'contact-1',
                name: 'Existing Owner',
                email: 'owner@existingschool.com',
                phone: '+233240001122',
                isPrimary: true,
                isSignatory: true,
              },
            ],
          }),
        }),
      })),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: false,
        docs: [
          {
            exists: true,
            data: () => ({
              displayName: 'Existing School Academy',
              primaryEmail: 'owner@existingschool.com',
              primaryPhone: '+233240001122',
              entityContacts: [],
            }),
          },
        ],
      }),
    })),
  },
}));

vi.mock('../entity-duplicate-detection', () => ({
  findDuplicateEntities: vi.fn().mockResolvedValue([
    {
      entityId: 'entity_existing_123',
      name: 'Existing School Academy',
      reason: 'Name match',
    },
  ]),
}));

vi.mock('../entity-actions', () => ({
  updateEntityAction: vi.fn().mockResolvedValue({ success: true, id: 'entity_existing_123' }),
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Signup Conflict Resolution Server Actions', () => {
  const sampleInput: SignupInput = {
    organizationId: 'smartsapp-hq',
    workspaceId: 'onboarding',
    name: 'Existing School Academy',
    location: 'Accra, Ghana',
    nominalRoll: 250,
    pipelineId: 'default_pipeline',
    stageId: 'welcome',
    entityContacts: [
      {
        id: 'new-contact-1',
        name: 'New Owner Name',
        email: 'owner@existingschool.com',
        phone: '+233240001122',
        typeKey: 'school_owner',
        typeLabel: 'School Owner',
        isPrimary: true,
        isSignatory: true,
        order: 0,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checkSignupDuplicatesAction returns enriched duplicate matches when duplicates exist', async () => {
    const result = await checkSignupDuplicatesAction(sampleInput);
    expect(result.hasDuplicates).toBe(true);
    expect(result.duplicates.length).toBeGreaterThan(0);
    expect(result.duplicates[0].entityId).toBe('entity_existing_123');
    expect(result.duplicates[0].name).toBe('Existing School Academy');
  });

  it('mergeSignupIntoEntityAction cleanly merges contacts and updates entity profile', async () => {
    const result = await mergeSignupIntoEntityAction('entity_existing_123', sampleInput);
    expect(result.success).toBe(true);
    expect(result.entityId).toBe('entity_existing_123');
  });
});
