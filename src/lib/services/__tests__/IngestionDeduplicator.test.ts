import { describe, it, expect } from 'vitest';
import { IngestionDeduplicator } from '../IngestionDeduplicator';
import type { DuplicateStrategy } from '../../import-types';

describe('IngestionDeduplicator', () => {
    const existingEntity = {
        id: 'workspace1_entity1',
        displayName: 'Test Company',
        primaryEmail: 'info@test.com',
        primaryPhone: '1234567890',
        workspaceTags: ['tag1'],
        entityContacts: [
            { id: 'c1', name: 'John', email: 'john@test.com', phone: '111', isPrimary: true },
            { id: 'c2', name: 'Jane', email: 'jane@test.com', phone: '222', isPrimary: false }
        ],
        customData: {
            existingField: 'Keep me'
        }
    };

    const incomingData = {
        displayName: 'Test Company Updated',
        primaryEmail: 'newinfo@test.com',
        primaryPhone: '0987654321',
        workspaceTags: ['tag2'],
        entityContacts: [
            { id: 'c3', name: 'John', email: 'john@test.com', phone: '333', isPrimary: true }, // matches John by email
            { id: 'c4', name: 'Alice', email: 'alice@test.com', phone: '444', isPrimary: false } // new contact
        ],
        customData: {
            newField: 'Add me'
        }
    };

    it('should return null for SKIP strategy', () => {
        const result = IngestionDeduplicator.reconcile(existingEntity, incomingData, 'SKIP', []);
        expect(result).toBeNull();
    });

    it('should NOT return null for TRIGGER_AUTOMATION strategy (it updates tags)', () => {
        const result = IngestionDeduplicator.reconcile(existingEntity, incomingData, 'TRIGGER_AUTOMATION', []);
        expect(result).not.toBeNull();
        expect(result.workspaceTags).toContain('tag2');
    });

    it('should append tags and merge nested contacts for ADD_TAG_ONLY', () => {
        const result = IngestionDeduplicator.reconcile(existingEntity, incomingData, 'ADD_TAG_ONLY', ['global1']);
        
        expect(result).not.toBeNull();
        if (!result) return;

        // Display name shouldn't change
        expect(result.displayName).toBe('Test Company');
        
        // Tags should merge
        expect(result.workspaceTags).toEqual(['tag1', 'tag2', 'global1']);
        
        // Contacts should NOT be merged (ADD_TAG_ONLY only adds tags)
        expect(result.entityContacts).toHaveLength(2); // Jane, John
        
        const john = result.entityContacts.find((c: any) => c.name === 'John');
        expect(john?.phone).toBe('111'); // Kept existing
    });

    it('should update missing fields for UPDATE_MISSING_FIELDS_AND_TAG', () => {
        const existingWithMissing = {
            ...existingEntity,
            primaryPhone: '' // Missing
        };

        const result = IngestionDeduplicator.reconcile(existingWithMissing, incomingData, 'UPDATE_MISSING_FIELDS_AND_TAG', []);
        
        expect(result).not.toBeNull();
        if (!result) return;

        // Display name is present, shouldn't change
        expect(result.displayName).toBe('Test Company');
        
        // Missing primary phone should be updated (re-derived)
        // Wait, John's phone wasn't missing ('111'), so primary phone remains '111'
        expect(result.primaryPhone).toBe('111');
        
        // John's missing phone should NOT be updated because it's not missing ('111')
        const john = result.entityContacts.find((c: any) => c.name === 'John');
        expect(john?.phone).toBe('111');
    });

    it('should completely overwrite for UPDATE_FIELDS_AND_TAG', () => {
        const result = IngestionDeduplicator.reconcile(existingEntity, incomingData, 'UPDATE_FIELDS_AND_TAG', []);
        
        expect(result).not.toBeNull();
        if (!result) return;

        // Top level fields should be overwritten (displayName is not in skipKeys)
        expect(result.displayName).toBe('Test Company Updated');
        
        // John's phone should be updated to '333'
        const john = result.entityContacts.find((c: any) => c.name === 'John');
        expect(john?.phone).toBe('333');
        
        // Because John was primary and his phone changed, primaryPhone changes to 333
        expect(result.primaryPhone).toBe('333');
    });
});
