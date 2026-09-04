import { describe, it, expect } from 'vitest';
import { 
  resolveEntityContacts, 
  getPrimaryContact, 
  getContactByType, 
  enforceContactConstraints 
} from '@/lib/entity-contact-helpers';
import type { Entity, EntityContact } from '@/lib/types';

describe('Entity Contact Primary Tags & Single Source of Truth', () => {
  it('correctly identifies isPrimary as the true source of truth and normalizes legacy primary role', () => {
    const legacyEntity: Partial<Entity> = {
      id: 'ent-1',
      name: 'Test Academy',
      entityType: 'institution',
      entityContacts: [
        {
          id: 'c1',
          name: 'Benedicta Ekenlebie Ofosu-Tanoh',
          email: 'ekenlebie@gmail.com',
          phone: '+233203007774',
          typeKey: 'primary',
          typeLabel: 'Primary',
          isPrimary: true,
          isSignatory: true,
          order: 0,
        },
        {
          id: 'c2',
          name: 'Kofi Mensah',
          email: 'kofi@example.com',
          phone: '+233244000000',
          typeKey: 'accountant',
          typeLabel: 'Accountant',
          isPrimary: false,
          isSignatory: false,
          order: 1,
        }
      ]
    };

    const resolved = resolveEntityContacts(legacyEntity);

    // Primary contact must maintain isPrimary = true
    expect(resolved[0].isPrimary).toBe(true);
    expect(resolved[0].isSignatory).toBe(true);
    
    // Legacy 'primary' role must be sanitized to an actual organizational role
    expect(resolved[0].typeKey).toBe('administrator');
    expect(resolved[0].typeLabel).toBe('Administrator');

    // Second contact remains unchanged
    expect(resolved[1].typeKey).toBe('accountant');
    expect(resolved[1].isPrimary).toBe(false);
  });

  it('getContactByType with "primary" seamlessly routes to getPrimaryContact for backward compatibility', () => {
    const entity: Partial<Entity> = {
      id: 'ent-2',
      name: 'St. Peter School',
      entityType: 'institution',
      entityContacts: [
        {
          id: 'c1',
          name: 'Sarah Owner',
          email: 'sarah@school.edu',
          typeKey: 'owner',
          typeLabel: 'Owner',
          isPrimary: true,
          isSignatory: true,
          order: 0,
        }
      ]
    };

    const primaryByRoleQuery = getContactByType(entity, 'primary');
    const primaryByHelper = getPrimaryContact(entity);

    expect(primaryByRoleQuery).toBeDefined();
    expect(primaryByRoleQuery?.id).toBe('c1');
    expect(primaryByRoleQuery?.name).toBe('Sarah Owner');
    expect(primaryByRoleQuery).toEqual(primaryByHelper);
  });

  it('enforceContactConstraints cleanses legacy primary role before saving to database', () => {
    const contactsToSave: EntityContact[] = [
      {
        id: 'c1',
        name: 'Benedicta',
        email: 'benedicta@example.com',
        typeKey: 'primary',
        typeLabel: 'Primary',
        isPrimary: true,
        isSignatory: true,
        order: 0,
      }
    ];

    const result = enforceContactConstraints(contactsToSave);

    expect(result).toHaveLength(1);
    expect(result[0].isPrimary).toBe(true);
    expect(result[0].typeKey).toBe('administrator');
    expect(result[0].typeLabel).toBe('Administrator');
  });

  it('handles fallback contacts array and preserves isPrimary flag', () => {
    const legacyEntityWithContacts: any = {
      id: 'ent-3',
      name: 'Legacy School',
      entityType: 'institution',
      contacts: [
        {
          id: 'c-legacy',
          name: 'Legacy Admin',
          email: 'admin@legacy.com',
          role: 'Primary',
          isPrimary: true,
          isSignatory: true,
        }
      ]
    };

    const resolved = resolveEntityContacts(legacyEntityWithContacts);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].isPrimary).toBe(true);
    expect(resolved[0].typeKey).toBe('administrator');
    expect(resolved[0].typeLabel).toBe('Administrator');
  });
});
