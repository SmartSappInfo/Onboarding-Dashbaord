import type { DuplicateStrategy } from '../import-types';
import { enforceContactConstraints } from '../entity-contact-helpers';

/**
 * Service to handle deduplication and merging of incoming import records
 * into existing entity/contact documents based on user-selected strategies.
 */
export class IngestionDeduplicator {
  /**
   * Helper to normalize values for loose matching
   */
  private static normalizeForMatch(val: any): string {
    if (!val || typeof val !== 'string') return '';
    return val.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Find the matching contact index in the nested array
   * Matches by email, phone, or name
   */
  public static findMatchingContactIndex(contacts: any[], incomingContact: any): number {
    const incEmail = this.normalizeForMatch(incomingContact.email);
    const incPhone = this.normalizeForMatch(incomingContact.phone);
    const incName = this.normalizeForMatch(incomingContact.name);

    return contacts.findIndex((c: any) => {
      const cEmail = this.normalizeForMatch(c.email);
      const cPhone = this.normalizeForMatch(c.phone);
      const cName = this.normalizeForMatch(c.name);

      if (incEmail && cEmail === incEmail) return true;
      if (incPhone && cPhone === incPhone) return true;
      if (incName && cName === incName) return true;
      return false;
    });
  }

  /**
   * Reconciles a duplicate contact based on selected strategy
   */
  static reconcile(
    existingEntity: any,
    incomingData: any, // The new workspaceEntityDoc payload
    strategy: DuplicateStrategy,
    globalTags: string[]
  ): any {
    if (strategy === 'SKIP' || strategy === 'MANUAL_CORRECTION') return null;

    let updatedEntity = { ...existingEntity };

    // 1. Merge Tags
    const currentTags = existingEntity.workspaceTags || [];
    const incomingTags = incomingData.workspaceTags || [];
    updatedEntity.workspaceTags = Array.from(new Set([...currentTags, ...incomingTags, ...globalTags]));

    if (strategy === 'TRIGGER_AUTOMATION' || strategy === 'ADD_TAG_ONLY') {
        updatedEntity.updatedAt = new Date().toISOString();
        return updatedEntity;
    }

    // 2. Merge contacts
    let contacts: any[] = [];
    if (strategy === 'KEEP_AND_MERGE' || strategy === 'REPLACE_AND_MERGE') {
        const existingContacts = (existingEntity.entityContacts || []).map((c: any) => ({ ...c }));
        const incomingContactsRaw = (incomingData.entityContacts || []).map((c: any) => ({ ...c }));

        // Deduplication fail-safe: filter incoming contact details based on existing contacts
        const processedIncoming = incomingContactsRaw.map((incomingContact: any) => {
            const resultContact = { ...incomingContact };
            const normEmail = IngestionDeduplicator.normalizeForMatch(incomingContact.email);
            const normPhone = IngestionDeduplicator.normalizeForMatch(incomingContact.phone);

            let hasDuplicateEmail = false;
            let hasDuplicatePhone = false;

            for (const ec of existingContacts) {
                if (normEmail && IngestionDeduplicator.normalizeForMatch(ec.email) === normEmail) {
                    hasDuplicateEmail = true;
                }
                if (normPhone && IngestionDeduplicator.normalizeForMatch(ec.phone) === normPhone) {
                    hasDuplicatePhone = true;
                }
            }

            // If duplicate email exists in other records, skip saving the email (delete it)
            if (hasDuplicateEmail) {
                delete resultContact.email;
            }
            // If duplicate phone exists in other records, skip saving the phone (delete it)
            if (hasDuplicatePhone) {
                delete resultContact.phone;
            }

            return resultContact;
        }).filter((c: any) => c.name || c.email || c.phone); // ensure contact isn't completely empty

        if (strategy === 'KEEP_AND_MERGE') {
            const mappedIncoming = processedIncoming.map((c: any, index: number) => ({
                ...c,
                id: c.id || `ec_${Math.random().toString(36).substr(2, 9)}`,
                isPrimary: false,
                isSignatory: false,
                order: existingContacts.length + index
            }));
            contacts = [...existingContacts, ...mappedIncoming];
        } else {
            // REPLACE_AND_MERGE
            const mappedIncoming = processedIncoming.map((c: any) => ({ ...c }));
            const demotedExisting = existingContacts.map((c: any, index: number) => ({
                ...c,
                isPrimary: false,
                isSignatory: false,
                order: mappedIncoming.length + index
            }));
            contacts = [...mappedIncoming, ...demotedExisting];
        }
    } else {
        contacts = [...(existingEntity.entityContacts || [])];
        const incomingContacts = incomingData.entityContacts || [];
        for (const incContact of incomingContacts) {
            const idx = this.findMatchingContactIndex(contacts, incContact);
            if (idx !== -1) {
                const target = { ...contacts[idx] };
                if (strategy === 'UPDATE_FIELDS_AND_TAG') {
                    contacts[idx] = { ...target, ...incContact };
                } else if (strategy === 'UPDATE_MISSING_FIELDS_AND_TAG') {
                    Object.keys(incContact).forEach(key => {
                        if (!target[key] || target[key] === '') {
                            target[key] = incContact[key];
                        }
                    });
                    contacts[idx] = target;
                }
            } else {
                // New contact
                contacts.push(incContact);
            }
        }
    }

    updatedEntity.entityContacts = enforceContactConstraints(contacts);
    const primary = updatedEntity.entityContacts.find((c: any) => c.isPrimary) || updatedEntity.entityContacts[0];

    updatedEntity.primaryContactName = primary?.name || updatedEntity.primaryContactName || '';
    updatedEntity.primaryEmail = primary?.email || updatedEntity.primaryEmail || '';
    updatedEntity.primaryPhone = primary?.phone || updatedEntity.primaryPhone || '';

    // 3. Merge Entity Top-level Fields
    const skipKeys = ['id', 'entityId', 'workspaceId', 'organizationId', 'addedAt', 'updatedAt', 'workspaceTags', 'entityContacts', 'primaryContactName', 'primaryEmail', 'primaryPhone'];

    if (strategy === 'UPDATE_FIELDS_AND_TAG') {
        Object.keys(incomingData).forEach(key => {
            if (skipKeys.includes(key)) return;
            if (typeof incomingData[key] === 'object' && incomingData[key] !== null && !Array.isArray(incomingData[key])) {
               updatedEntity[key] = { ...(updatedEntity[key] || {}), ...incomingData[key] };
            } else {
               updatedEntity[key] = incomingData[key];
            }
        });
    } else if (strategy === 'UPDATE_MISSING_FIELDS_AND_TAG' || strategy === 'KEEP_AND_MERGE') {
        Object.keys(incomingData).forEach(key => {
            if (skipKeys.includes(key)) return;
            if (typeof incomingData[key] === 'object' && incomingData[key] !== null && !Array.isArray(incomingData[key])) {
                const existingObj = updatedEntity[key] || {};
                const incObj = incomingData[key];
                const mergedObj = { ...existingObj };
                Object.keys(incObj).forEach(k => {
                    if (!mergedObj[k] || mergedObj[k] === '') {
                        mergedObj[k] = incObj[k];
                    }
                });
                updatedEntity[key] = mergedObj;
            } else {
                if (!updatedEntity[key] || updatedEntity[key] === '') {
                    updatedEntity[key] = incomingData[key];
                }
            }
        });
    } else if (strategy === 'REPLACE_AND_MERGE') {
        Object.keys(incomingData).forEach(key => {
            if (skipKeys.includes(key)) return;
            if (typeof incomingData[key] === 'object' && incomingData[key] !== null && !Array.isArray(incomingData[key])) {
                const existingObj = updatedEntity[key] || {};
                const incObj = incomingData[key];
                const mergedObj = { ...existingObj };
                Object.keys(incObj).forEach(k => {
                    if (incObj[k] !== undefined && incObj[k] !== null && incObj[k] !== '') {
                        mergedObj[k] = incObj[k];
                    }
                });
                updatedEntity[key] = mergedObj;
            } else {
                if (incomingData[key] !== undefined && incomingData[key] !== null && incomingData[key] !== '') {
                    updatedEntity[key] = incomingData[key];
                }
            }
        });
    }

    updatedEntity.updatedAt = new Date().toISOString();
    return updatedEntity;
  }
}
