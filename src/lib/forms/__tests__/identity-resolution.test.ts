import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeEmail,
  normalizePhone,
  resolveAndEnrichCrmEntity,
  getKnownRespondentProfile,
} from '../identity-resolution';
import type { Form } from '@/lib/types';

// Mock dependencies
vi.mock('@/lib/firebase-admin', () => {
  const mockEntitiesDoc = vi.fn();
  const mockEntitiesWhere = vi.fn();
  const mockEntitiesCollection = {
    doc: mockEntitiesDoc,
    where: mockEntitiesWhere,
  };

  const mockAppFieldsWhere = vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue({
      docs: [
        { data: () => ({ variableName: 'email', isNative: true }) },
        { data: () => ({ variableName: 'phone', isNative: true }) },
        { data: () => ({ variableName: 'budget', isNative: false }) },
      ],
    }),
  });

  const mockCollection = vi.fn((name: string) => {
    if (name === 'workspace_entities') return mockEntitiesCollection;
    if (name === 'app_fields') return { where: mockAppFieldsWhere };
    return {
      doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) }),
      add: vi.fn().mockResolvedValue({ id: 'act_123' }),
    };
  });

  return {
    adminDb: {
      collection: mockCollection,
    },
  };
});

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/tag-actions', () => ({
  applyTagsAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/entity-actions', () => ({
  createEntityAction: vi.fn().mockResolvedValue({ success: true, id: 'entity_new_123' }),
  updateEntityAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe('SmartSapp Forms 2.0: Identity Resolution & Progressive Profiling', () => {
  const mockForm: Form = {
    id: 'form_test',
    workspaceId: 'ws_test',
    organizationId: 'org_test',
    internalName: 'Admissions Form',
    title: 'Admissions Form',
    slug: 'admissions-form',
    formType: 'global',
    contactScope: 'person',
    fields: [],
    theme: { preset: 'professional' } as any,
    successBehavior: { type: 'message' },
    actions: {
      entityHandling: 'create_or_update',
      tags: ['tag_admissions'],
      automations: [],
      webhooks: [],
    },
    status: 'published',
    submissionCount: 5,
    createdAt: '2026-09-01T00:00:00Z',
  };

  describe('Email & Phone Normalization', () => {
    it('normalizes valid emails to lower case and trims whitespace', () => {
      expect(normalizeEmail('  John.Doe@Example.COM  ')).toBe('john.doe@example.com');
      expect(normalizeEmail('invalid-string')).toBe(null);
      expect(normalizeEmail(null)).toBe(null);
    });

    it('normalizes phone numbers by stripping dashes, parens, and spaces', () => {
      expect(normalizePhone('+1 (555) 019-2834')).toBe('+15550192834');
      expect(normalizePhone('123')).toBe(null); // Too short
      expect(normalizePhone(undefined)).toBe(null);
    });
  });

  describe('Multi-Attribute Matching Hierarchy', () => {
    it('resolves directly by explicitEntityId (Tier 1)', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');
      const mockDoc = vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          id: 'ent_tier1',
          data: () => ({ workspaceId: 'ws_test', entityId: 'ent_tier1' }),
        }),
      });
      (adminDb.collection as any)('workspace_entities').doc = mockDoc;

      const result = await resolveAndEnrichCrmEntity({
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        form: mockForm,
        formData: { email: 'john@example.com' },
        explicitEntityId: 'ent_tier1',
      });

      expect(result.matched).toBe(true);
      expect(result.entityId).toBe('ent_tier1');
      expect(result.matchKey).toBe('entityId');
    });

    it('resolves by primaryEmail (Tier 2)', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');
      const mockWhere = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ id: 'ent_email_match', data: () => ({ entityId: 'ent_email_match' }) }],
            }),
          }),
        }),
      });
      (adminDb.collection as any)('workspace_entities').where = mockWhere;

      const result = await resolveAndEnrichCrmEntity({
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        form: mockForm,
        formData: { email: 'sarah@example.com' },
      });

      expect(result.matched).toBe(true);
      expect(result.entityId).toBe('ent_email_match');
      expect(result.matchKey).toBe('email');
    });

    it('creates new contact when no match is found (Fallback)', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');
      const mockWhere = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              empty: true,
              docs: [],
            }),
          }),
        }),
      });
      (adminDb.collection as any)('workspace_entities').where = mockWhere;

      const result = await resolveAndEnrichCrmEntity({
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        form: mockForm,
        formData: { name: 'New Student', email: 'brand_new@example.com', budget: '5000' },
      });

      expect(result.matched).toBe(true);
      expect(result.entityId).toBe('entity_new_123');
      expect(result.matchKey).toBe('created_new');
    });
  });

  describe('Progressive Profiling Profile Resolution', () => {
    it('fetches known respondent profile attributes accurately', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');
      const mockDoc = vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          id: 'ent_known_888',
          data: () => ({
            workspaceId: 'ws_test',
            name: 'Alex Johnson',
            primaryEmail: 'alex@example.com',
            primaryPhone: '+15550001111',
            customData: {
              company: 'Acme Corp',
            },
          }),
        }),
      });
      (adminDb.collection as any)('workspace_entities').doc = mockDoc;

      const profile = await getKnownRespondentProfile('ws_test', 'ent_known_888');
      expect(profile.found).toBe(true);
      expect(profile.name).toBe('Alex Johnson');
      expect(profile.knownValues.primaryEmail).toBe('alex@example.com');
      expect(profile.knownValues.company).toBe('Acme Corp');
      expect(profile.alreadyCapturedFieldKeys).toContain('primaryEmail');
    });
  });
});
