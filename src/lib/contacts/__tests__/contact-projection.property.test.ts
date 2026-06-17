import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { WorkspaceEntity, EntityContact } from '@/lib/types';
import {
  flattenEntityContacts,
  diffContactDocs,
  type ContactDoc,
} from '../contact-projection-domain';

/**
 * Drift invariant (Phase 6.1): for ANY prior projection state `prev`, applying
 * one `diffContactDocs(prev, flatten(WE))` sync makes the stored rows EXACTLY
 * equal the flatten output. This is what guarantees a single `reconcile` pass
 * heals any drift, no matter how a write path left the collection.
 */

function applyDiff(prev: ContactDoc[], next: ContactDoc[]): ContactDoc[] {
  const { upserts, deleteIds } = diffContactDocs(prev, next);
  const byId = new Map(prev.map((d) => [d.id, d]));
  for (const id of deleteIds) byId.delete(id);
  for (const d of upserts) byId.set(d.id, d);
  return [...byId.values()];
}

/** Stable, order-independent comparison of two ContactDoc sets. */
function asSet(docs: ContactDoc[]): Set<string> {
  return new Set(docs.map((d) => JSON.stringify(d)));
}

const contactArb: fc.Arbitrary<EntityContact> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 6 }).filter((s) => !s.includes('/')),
  name: fc.string({ maxLength: 12 }),
  email: fc.option(fc.emailAddress(), { nil: undefined }),
  phone: fc.option(fc.string({ minLength: 3, maxLength: 8 }), { nil: undefined }),
  typeKey: fc.constantFrom('head', 'finance', 'custom'),
  isPrimary: fc.boolean(),
  isSignatory: fc.constant(false),
  order: fc.nat({ max: 10 }),
}) as fc.Arbitrary<EntityContact>;

function weArb(): fc.Arbitrary<WorkspaceEntity> {
  return fc
    .record({
      contacts: fc.array(contactArb, { maxLength: 6 }),
      tags: fc.array(fc.string({ maxLength: 5 }), { maxLength: 4 }),
      status: fc.constantFrom<'active' | 'archived'>('active', 'archived'),
      primaryEmail: fc.option(fc.emailAddress(), { nil: undefined }),
    })
    .map(
      ({ contacts, tags, status, primaryEmail }) =>
        ({
          id: 'we1',
          organizationId: 'org1',
          workspaceId: 'ws1',
          entityId: 'ent1',
          entityType: 'institution',
          status,
          workspaceTags: tags,
          addedAt: '2026-01-01',
          updatedAt: '2026-01-01',
          displayName: 'Acme',
          entityContacts: contacts,
          primaryEmail,
        }) as WorkspaceEntity,
    );
}

describe('contact projection — drift convergence (property)', () => {
  it('one sync makes the projection equal flatten(WE), from any prior state', () => {
    fc.assert(
      fc.property(
        weArb(),
        // arbitrary prior state: mutate/drop/add rows relative to the truth
        fc.array(contactArb, { maxLength: 6 }),
        (we, strayContacts) => {
          const next = flattenEntityContacts(we);

          // Build a messy `prev`: some correct rows, some stale (mutated),
          // some orphan rows that should be deleted.
          const stale = next.slice(0, 1).map((d) => ({ ...d, name: d.name + '_old', nameLower: 'stale' }));
          const orphans = flattenEntityContacts({
            ...we,
            entityId: 'ghost',
            entityContacts: strayContacts,
          } as WorkspaceEntity);
          const prev = [...next.slice(1), ...stale, ...orphans];

          const applied = applyDiff(prev, next);
          expect(asSet(applied)).toEqual(asSet(next));
        },
      ),
      { numRuns: 200 },
    );
  });

  it('re-syncing an already-correct projection is a no-op', () => {
    fc.assert(
      fc.property(weArb(), (we) => {
        const next = flattenEntityContacts(we);
        const { upserts, deleteIds } = diffContactDocs(next, next);
        expect(upserts).toEqual([]);
        expect(deleteIds).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});
