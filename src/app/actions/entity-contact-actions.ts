'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Entity, EntityContact, WorkspaceEntity } from '@/lib/types';

/**
 * Returns the canonical contacts (`entityContacts`) for an entity.
 *
 * Reads from the global `entities` collection (NOT `workspace_entities` — that
 * record does not hold the contact list). Used by the deal creation flow to
 * let the user pick focal contacts from the deal's own entity.
 *
 * Returns an empty array when the entity is missing or has no contacts so
 * callers can render an empty state without special-casing errors.
 */
export async function getEntityContactsAction(entityId: string): Promise<EntityContact[]> {
  try {
    if (!entityId) return [];
    const snap = await adminDb.collection('entities').doc(entityId).get();
    if (!snap.exists) return [];
    const entity = snap.data() as Entity;
    return entity.entityContacts ?? [];
  } catch (e) {
    console.error('Failed to load entity contacts:', e);
    return [];
  }
}

export type EntityAssignee = WorkspaceEntity['assignedTo'];

export interface EntityDealDefaults {
  contacts: EntityContact[];
  /** Workspace-scoped owner, used to pre-select the deal's default assignee. */
  assignedTo: EntityAssignee;
}

/**
 * One round-trip for the deal-creation form: the entity's focal-contact list
 * (global `entities` doc) and its workspace-scoped owner (`workspace_entities`
 * doc keyed `${workspaceId}_${entityId}`). The owner becomes the deal's default
 * assignee unless the creator overrides it.
 *
 * Always resolves (never throws) so the modal can render defaults without
 * special-casing errors; missing data yields `[]` / `null`.
 */
export async function getEntityDealDefaultsAction(
  entityId: string,
  workspaceId: string
): Promise<EntityDealDefaults> {
  if (!entityId || !workspaceId) return { contacts: [], assignedTo: null };
  try {
    const [entitySnap, wsSnap] = await Promise.all([
      adminDb.collection('entities').doc(entityId).get(),
      adminDb.collection('workspace_entities').doc(`${workspaceId}_${entityId}`).get(),
    ]);
    const contacts = entitySnap.exists ? ((entitySnap.data() as Entity).entityContacts ?? []) : [];
    const assignedTo = wsSnap.exists ? ((wsSnap.data() as WorkspaceEntity).assignedTo ?? null) : null;
    return { contacts, assignedTo };
  } catch (e) {
    console.error('Failed to load entity deal defaults:', e);
    return { contacts: [], assignedTo: null };
  }
}

export interface MatchedContactInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  typeLabel?: string;
  matchReason?: string;
}

export interface SearchedEntityResult {
  entityId: string;
  workspaceEntityId: string;
  name: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  entityType: string;
  matchedContact: MatchedContactInfo | null;
  allContacts: EntityContact[];
}

export interface SearchEntitiesForDealParams {
  workspaceId: string;
  search?: string;
  limit?: number;
}

/**
 * ARCHITECTURAL POINTER (Multi-Field Entity & Contact Search Engine):
 * Performs server-side multi-field matching across workspace entities AND their individual focal contacts.
 * Matches against:
 * 1. Entity Name / Display Name
 * 2. Primary Email
 * 3. Primary Phone (normalized digits)
 * 4. Focal Contacts: Contact Name, Email, Phone, Role/TypeLabel
 *
 * CAUTION FOR MAINTAINERS:
 * Always preserve digit normalization when comparing phone numbers to handle varied user formats (e.g. 024-273-7120 vs +233242737120).
 * Keep max result limit capped to prevent resource exhaustion during high-load deal creation sessions.
 *
 * TESTABILITY POINTER:
 * Unit tests should verify that searching by a contact's email or phone returns the parent entity with matchedContact pre-populated.
 */
export async function searchEntitiesForDealAction({
  workspaceId,
  search = '',
  limit: maxResults = 30,
}: SearchEntitiesForDealParams): Promise<SearchedEntityResult[]> {
  try {
    if (!workspaceId) return [];

    const rawTerm = search.trim().toLowerCase();
    const digitsOnly = rawTerm.replace(/\D/g, '');

    // 1. Fetch workspace entities scoped to the current tenant workspace
    const wsEntitiesSnap = await adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', workspaceId)
      .limit(150)
      .get();

    if (wsEntitiesSnap.empty) return [];

    const workspaceDocs = wsEntitiesSnap.docs.map(doc => {
      const data = doc.data() as WorkspaceEntity;
      return {
        docId: doc.id,
        entityId: data.entityId || doc.id.replace(`${workspaceId}_`, ''),
        data,
      };
    });

    // 2. Fetch corresponding global entity documents to inspect focal contacts
    const entityIds = [...new Set(workspaceDocs.map(d => d.entityId))];
    
    // Chunk array in 30s to respect Firestore 'in' query boundaries
    const chunks: string[][] = [];
    for (let i = 0; i < entityIds.length; i += 30) {
      chunks.push(entityIds.slice(i, i + 30));
    }

    const globalEntitiesMap = new Map<string, Entity>();
    await Promise.all(
      chunks.map(async chunk => {
        const snap = await adminDb
          .collection('entities')
          .where('__name__', 'in', chunk)
          .get();
        snap.docs.forEach(d => {
          globalEntitiesMap.set(d.id, d.data() as Entity);
        });
      })
    );

    // 3. Multi-field filtering logic
    const results: SearchedEntityResult[] = [];

    for (const item of workspaceDocs) {
      const we = (item.data as unknown) as Record<string, unknown>;
      const globalEntity = (globalEntitiesMap.get(item.entityId) || {}) as Record<string, unknown>;

      const entityName = String(we.displayName || we.name || we.entityName || globalEntity.displayName || globalEntity.name || '').trim();
      const entityNameLower = entityName.toLowerCase();
      const entityEmail = String(we.primaryEmail || we.email || globalEntity.primaryEmail || globalEntity.email || '').trim().toLowerCase();
      const entityPhone = String(we.primaryPhone || we.phone || globalEntity.primaryPhone || globalEntity.phone || '').trim();
      const entityPhoneDigits = entityPhone.replace(/\D/g, '');
      const entityType = String(we.entityType || globalEntity.entityType || 'entity');

      const contacts: EntityContact[] = (Array.isArray(globalEntity.entityContacts) ? globalEntity.entityContacts : Array.isArray(we.entityContacts) ? we.entityContacts : []) as EntityContact[];

      let matchedContactInfo: MatchedContactInfo | null = null;
      let isMatch = false;

      // If search term is empty, list all recent workspace entities
      if (!rawTerm) {
        isMatch = true;
      } else {
        // A) Match Entity Name
        if (entityNameLower.includes(rawTerm)) {
          isMatch = true;
        }

        // B) Match Primary Email
        if (!isMatch && entityEmail && entityEmail.includes(rawTerm)) {
          isMatch = true;
        }

        // C) Match Primary Phone
        if (!isMatch && entityPhone) {
          if (entityPhone.toLowerCase().includes(rawTerm) || (digitsOnly && digitsOnly.length >= 3 && entityPhoneDigits.includes(digitsOnly))) {
            isMatch = true;
          }
        }

        // D) Match Contacts (Name, Email, Phone, TypeLabel)
        for (const c of contacts) {
          const cName = (c.name || '').trim().toLowerCase();
          const cEmail = (c.email || '').trim().toLowerCase();
          const cPhone = (c.phone || '').trim();
          const cPhoneDigits = cPhone.replace(/\D/g, '');
          const cRole = (c.typeLabel || '').trim().toLowerCase();

          let cMatched = false;
          let reason = '';

          if (cName && cName.includes(rawTerm)) {
            cMatched = true;
            reason = 'Matched by Contact Name';
          } else if (cEmail && cEmail.includes(rawTerm)) {
            cMatched = true;
            reason = 'Matched by Contact Email';
          } else if (cPhone && (cPhone.toLowerCase().includes(rawTerm) || (digitsOnly && digitsOnly.length >= 3 && cPhoneDigits.includes(digitsOnly)))) {
            cMatched = true;
            reason = 'Matched by Contact Phone';
          } else if (cRole && cRole.includes(rawTerm)) {
            cMatched = true;
            reason = 'Matched by Contact Role';
          }

          if (cMatched) {
            isMatch = true;
            matchedContactInfo = {
              id: c.id,
              name: c.name,
              email: c.email,
              phone: c.phone,
              typeLabel: c.typeLabel,
              matchReason: reason,
            };
            break; // Matched focal contact found
          }
        }
      }

      if (isMatch) {
        results.push({
          entityId: item.entityId,
          workspaceEntityId: item.docId,
          name: entityName || 'Unnamed Entity',
          displayName: entityName || 'Unnamed Entity',
          email: entityEmail || null,
          phone: entityPhone || null,
          entityType,
          matchedContact: matchedContactInfo,
          allContacts: contacts,
        });

        if (results.length >= maxResults) break;
      }
    }

    return results;
  } catch (e) {
    console.error('Failed searchEntitiesForDealAction:', e);
    return [];
  }
}
