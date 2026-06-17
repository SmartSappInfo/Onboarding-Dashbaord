import { describe, it, expect } from 'vitest';
import type { WorkspaceEntity, EntityContact } from '@/lib/types';
import {
  contactDocId,
  deriveChannels,
  reachField,
  channelsOf,
  flattenEntityContacts,
  diffContactDocs,
  contactSegmentToQuerySpec,
  matchesInvitationFilter,
  pickPrimaryPerEntity,
  type ContactDoc,
  type InvitationFilterCore,
} from '../contact-projection-domain';

function we(overrides: Partial<WorkspaceEntity> = {}): WorkspaceEntity {
  return {
    id: 'we1',
    organizationId: 'org1',
    workspaceId: 'ws1',
    entityId: 'ent1',
    entityType: 'institution' as WorkspaceEntity['entityType'],
    status: 'active',
    workspaceTags: [],
    addedAt: '2026-01-01',
    updatedAt: '2026-01-01',
    displayName: 'Green Valley School',
    entityContacts: [],
    ...overrides,
  } as WorkspaceEntity;
}

function contact(overrides: Partial<EntityContact> = {}): EntityContact {
  return {
    id: 'c1',
    name: 'Ama Mensah',
    email: 'ama@example.com',
    phone: '+233242737120',
    typeKey: 'head',
    typeLabel: 'Head Teacher',
    isPrimary: true,
    isSignatory: false,
    order: 0,
    ...overrides,
  };
}

describe('contactDocId', () => {
  it('is deterministic and path-safe', () => {
    expect(contactDocId('ws1', 'ent1', 'c1')).toBe('ws1__ent1__c1');
    expect(contactDocId('ws/1', 'ent/1', 'c/1')).toBe('ws_1__ent_1__c_1');
  });
});

describe('deriveChannels', () => {
  it('email → email; phone → sms + call', () => {
    expect(deriveChannels('a@b.com', '+2330')).toEqual(['email', 'sms', 'call']);
    expect(deriveChannels('a@b.com', null)).toEqual(['email']);
    expect(deriveChannels('', '+2330')).toEqual(['sms', 'call']);
    expect(deriveChannels(null, null)).toEqual([]);
  });
  it('ignores whitespace-only values', () => {
    expect(deriveChannels('   ', '   ')).toEqual([]);
  });
});

describe('reachField / channelsOf', () => {
  it('maps a segment channel to its boolean flag', () => {
    expect(reachField('email')).toBe('hasEmail');
    expect(reachField('sms')).toBe('hasPhone');
    expect(reachField('call')).toBe('hasPhone');
  });
  it('derives a display channel list from booleans', () => {
    expect(channelsOf({ hasEmail: true, hasPhone: true })).toEqual(['email', 'sms', 'call']);
    expect(channelsOf({ hasEmail: false, hasPhone: true })).toEqual(['sms', 'call']);
    expect(channelsOf({ hasEmail: true, hasPhone: false })).toEqual(['email']);
  });
});

describe('contactSegmentToQuerySpec', () => {
  it('maps channel to the boolean equality and defaults status to active', () => {
    const spec = contactSegmentToQuerySpec('ws1', { channel: 'email' });
    expect(spec.equalities).toEqual([
      { field: 'workspaceId', value: 'ws1' },
      { field: 'hasEmail', value: true },
      { field: 'status', value: 'active' },
    ]);
    expect(spec.orderBy).toBe('nameLower');
    expect(spec.range).toBeUndefined();
    expect(spec.arrayContains).toBeUndefined();
  });

  it('sms/call filter on hasPhone', () => {
    expect(contactSegmentToQuerySpec('ws1', { channel: 'sms' }).equalities[1]).toEqual({
      field: 'hasPhone',
      value: true,
    });
    expect(contactSegmentToQuerySpec('ws1', { channel: 'call' }).equalities[1]).toEqual({
      field: 'hasPhone',
      value: true,
    });
  });

  it('an email-looking search ranges on emailLower', () => {
    const spec = contactSegmentToQuerySpec('ws1', { channel: 'email', search: 'Ama@Ex.com' });
    expect(spec.orderBy).toBe('emailLower');
    expect(spec.range).toEqual({ field: 'emailLower', prefix: 'ama@ex.com' });
  });

  it('a name search ranges on nameLower', () => {
    const spec = contactSegmentToQuerySpec('ws1', { channel: 'email', search: '  Green  Valley ' });
    expect(spec.orderBy).toBe('nameLower');
    expect(spec.range).toEqual({ field: 'nameLower', prefix: 'green valley' });
  });

  it('a tag filter forces name search (only nameLower+tags is indexed) and applies the first tag', () => {
    const spec = contactSegmentToQuerySpec('ws1', {
      channel: 'email',
      search: 'a@b.com',
      tags: ['vip', 'lead'],
    });
    expect(spec.orderBy).toBe('nameLower');
    expect(spec.range).toEqual({ field: 'nameLower', prefix: 'a@b.com' });
    expect(spec.arrayContains).toEqual({ field: 'workspaceTags', value: 'vip' });
  });

  it('honors an explicit archived status', () => {
    expect(contactSegmentToQuerySpec('ws1', { channel: 'email', status: 'archived' }).equalities[2]).toEqual({
      field: 'status',
      value: 'archived',
    });
  });
});

describe('flattenEntityContacts', () => {
  it('produces one row per reachable contact with denormalized fields', () => {
    const docs = flattenEntityContacts(
      we({
        workspaceTags: ['z-tag', 'a-tag'],
        zone: { id: 'zone-1', name: 'North' },
        assignedTo: { userId: 'u1', name: 'Rep', email: 'rep@x.com' },
        entityContacts: [contact()],
      }),
    );
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      id: 'ws1__ent1__c1',
      entityId: 'ent1',
      contactId: 'c1',
      nameLower: 'ama mensah',
      emailLower: 'ama@example.com',
      hasEmail: true,
      hasPhone: true,
      isPrimary: true,
      workspaceTags: ['a-tag', 'z-tag'], // sorted
      entityName: 'Green Valley School',
      zoneId: 'zone-1',
      assignedUserId: 'u1',
    });
  });

  it('drops contacts with no reachable channel', () => {
    const docs = flattenEntityContacts(
      we({ entityContacts: [contact({ id: 'c2', email: undefined, phone: undefined })] }),
    );
    expect(docs).toEqual([]);
  });

  it('synthesizes a primary-fallback row when there are no entityContacts', () => {
    const docs = flattenEntityContacts(
      we({ entityContacts: [], primaryEmail: 'office@gv.edu', primaryContactName: 'Front Desk' }),
    );
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      contactId: 'primary-fallback',
      name: 'Front Desk',
      email: 'office@gv.edu',
      hasEmail: true,
      hasPhone: false,
      isPrimary: true,
      typeKey: 'primary',
    });
  });

  it('returns [] when there are neither contacts nor a primary', () => {
    expect(flattenEntityContacts(we({ entityContacts: [] }))).toEqual([]);
  });

  it('falls back to entityId when doc id (we.id) is the only id present', () => {
    const docs = flattenEntityContacts(we({ entityId: '', id: 'doc9', entityContacts: [contact()] }));
    expect(docs[0].entityId).toBe('doc9');
    expect(docs[0].id).toBe('ws1__doc9__c1');
  });
});

describe('matchesInvitationFilter', () => {
  const doc = (over: Partial<Parameters<typeof matchesInvitationFilter>[0]> = {}) => ({
    hasEmail: true,
    hasPhone: true,
    assignedUserId: null,
    workspaceTags: [] as string[],
    isSignatory: false,
    typeKey: 'head',
    ...over,
  });
  const filter = (over: Partial<InvitationFilterCore> = {}): InvitationFilterCore => ({
    channels: ['email'],
    includeTagIds: [],
    excludeTagIds: [],
    includeLogic: 'OR',
    contactScope: 'all',
    roles: [],
    ...over,
  });

  it('matches on channel reachability (email/sms)', () => {
    expect(matchesInvitationFilter(doc({ hasEmail: false }), filter({ channels: ['email'] }))).toBe(false);
    expect(matchesInvitationFilter(doc({ hasEmail: false, hasPhone: true }), filter({ channels: ['sms'] }))).toBe(true);
    expect(matchesInvitationFilter(doc({ hasEmail: false, hasPhone: false }), filter({ channels: ['email', 'sms'] }))).toBe(false);
  });

  it('filters by assignee only when set', () => {
    expect(matchesInvitationFilter(doc({ assignedUserId: 'u1' }), filter({ assignedUserId: 'u1' }))).toBe(true);
    expect(matchesInvitationFilter(doc({ assignedUserId: 'u2' }), filter({ assignedUserId: 'u1' }))).toBe(false);
    expect(matchesInvitationFilter(doc({ assignedUserId: 'u2' }), filter({ assignedUserId: null }))).toBe(true);
  });

  it('applies include tags with AND / OR logic', () => {
    const d = doc({ workspaceTags: ['a', 'b'] });
    expect(matchesInvitationFilter(d, filter({ includeTagIds: ['a', 'c'], includeLogic: 'AND' }))).toBe(false);
    expect(matchesInvitationFilter(d, filter({ includeTagIds: ['a', 'b'], includeLogic: 'AND' }))).toBe(true);
    expect(matchesInvitationFilter(d, filter({ includeTagIds: ['a', 'c'], includeLogic: 'OR' }))).toBe(true);
  });

  it('excludes by tag', () => {
    const d = doc({ workspaceTags: ['vip'] });
    expect(matchesInvitationFilter(d, filter({ excludeTagIds: ['vip'] }))).toBe(false);
    expect(matchesInvitationFilter(d, filter({ excludeTagIds: ['other'] }))).toBe(true);
  });

  it('honors signatories and roles scope; primary passes per-doc', () => {
    expect(matchesInvitationFilter(doc({ isSignatory: false }), filter({ contactScope: 'signatories' }))).toBe(false);
    expect(matchesInvitationFilter(doc({ isSignatory: true }), filter({ contactScope: 'signatories' }))).toBe(true);
    expect(matchesInvitationFilter(doc({ typeKey: 'mother' }), filter({ contactScope: 'roles', roles: ['father'] }))).toBe(false);
    expect(matchesInvitationFilter(doc({ typeKey: 'father' }), filter({ contactScope: 'roles', roles: ['father'] }))).toBe(true);
    // 'primary' is decided by grouping, so a doc passes the per-doc check.
    expect(matchesInvitationFilter(doc(), filter({ contactScope: 'primary' }))).toBe(true);
  });
});

describe('pickPrimaryPerEntity', () => {
  it('keeps the flagged primary per entity, else the first seen', () => {
    const rows = [
      { entityId: 'e1', isPrimary: false, k: 'a' },
      { entityId: 'e1', isPrimary: true, k: 'b' },
      { entityId: 'e2', isPrimary: false, k: 'c' },
      { entityId: 'e2', isPrimary: false, k: 'd' },
    ];
    const out = pickPrimaryPerEntity(rows);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.entityId === 'e1')?.k).toBe('b'); // the primary
    expect(out.find((r) => r.entityId === 'e2')?.k).toBe('c'); // first seen
  });
});

describe('diffContactDocs', () => {
  const a: ContactDoc = flattenEntityContacts(we({ entityContacts: [contact()] }))[0];

  it('upserts new and changed rows, deletes removed ones', () => {
    const changed = { ...a, name: 'Ama M.', nameLower: 'ama m.' };
    const b: ContactDoc = { ...a, id: 'ws1__ent1__c2', contactId: 'c2' };

    // prev had [a]; next has [changed-a, b]
    const r1 = diffContactDocs([a], [changed, b]);
    expect(r1.upserts.map((d) => d.id).sort()).toEqual(['ws1__ent1__c1', 'ws1__ent1__c2']);
    expect(r1.deleteIds).toEqual([]);

    // prev had [a, b]; next has [a] → b removed
    const r2 = diffContactDocs([a, b], [a]);
    expect(r2.upserts).toEqual([]); // a unchanged
    expect(r2.deleteIds).toEqual(['ws1__ent1__c2']);
  });

  it('treats identical rows as no-ops (ignores doc id in fingerprint of content)', () => {
    const r = diffContactDocs([a], [{ ...a }]);
    expect(r.upserts).toEqual([]);
    expect(r.deleteIds).toEqual([]);
  });
});
