/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose & Scope:
 *    Unit tests for Pure CRM Entity Recipient Extraction & Normalization Service (Phase 9 Extension).
 * 2. Invariants Tested:
 *    - Deterministic contact role resolution ('signatory' vs 'primary' vs 'all').
 *    - Fallback behavior for organizations with zero entityContacts (FM-CRM-01).
 *    - Multi-contact expansion per entity when role is 'all' (FM-CRM-02).
 *    - Template variable completeness and missing variable detection (FM-P9-04).
 *    - DDE Formula injection sanitization (FM-P9-07).
 *    - Zero-tolerance typing: strictly zero `any` or `any[]`.
 */

import { describe, it, expect } from 'vitest';
import {
  extractRecipientsFromEntities,
  sanitizeEntityVariableValue,
  type CrmRecipientExtractionOptions,
} from '../crm-bulk-recipient-service';
import type { SearchedEntity } from '@/hooks/use-entity-search';

describe('CrmBulkRecipientService', () => {
  const mockEntities: SearchedEntity[] = [
    {
      id: 'doc-ent-01',
      entityId: 'ent-001',
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      entityType: 'institution',
      displayName: 'Acme Global Corp',
      status: 'active',
      workspaceTags: ['enterprise', 'q4-renewal'],
      addedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      primaryContactName: 'John Doe',
      primaryEmail: 'john@acme.com',
      primaryPhone: '+15551234567',
      locationString: 'Austin, TX, USA',
      entityContacts: [
        {
          id: 'cnt-01',
          name: 'John Doe',
          email: 'john@acme.com',
          phone: '+15551234567',
          isPrimary: true,
          isSignatory: false,
          typeKey: 'general_manager',
        },
        {
          id: 'cnt-02',
          name: 'Alice Signer',
          email: 'alice@acme.com',
          phone: '+15559876543',
          isPrimary: false,
          isSignatory: true,
          typeKey: 'chief_legal_officer',
        },
      ],
    } as unknown as SearchedEntity,
    {
      id: 'doc-ent-02',
      entityId: 'ent-002',
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      entityType: 'person',
      displayName: 'Cyberdyne Systems',
      status: 'active',
      workspaceTags: ['defense'],
      addedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      primaryContactName: 'Sarah Connor',
      primaryEmail: 'sarah@cyberdyne.com',
      entityContacts: [], // Zero entity contacts (FM-CRM-01)
    } as unknown as SearchedEntity,
    {
      id: 'doc-ent-03',
      entityId: 'ent-003',
      organizationId: 'org-test',
      workspaceId: 'ws-test',
      entityType: 'institution',
      displayName: 'No Contact Org',
      status: 'active',
      workspaceTags: [],
      addedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      entityContacts: [], // No contacts and no primary email
    } as unknown as SearchedEntity,
  ];

  describe('sanitizeEntityVariableValue (FM-P9-07 DDE Injection Defense)', () => {
    it('prepends single quote to values starting with formula trigger operators', () => {
      expect(sanitizeEntityVariableValue('=SUM(1+2)')).toBe("'=SUM(1+2)");
      expect(sanitizeEntityVariableValue('+123456789')).toBe("'+123456789");
      expect(sanitizeEntityVariableValue('-500')).toBe("'-500");
      expect(sanitizeEntityVariableValue('@admin')).toBe("'@admin");
      expect(sanitizeEntityVariableValue('|cmd')).toBe("'|cmd");
    });

    it('leaves standard text values untouched', () => {
      expect(sanitizeEntityVariableValue('Acme Corp')).toBe('Acme Corp');
      expect(sanitizeEntityVariableValue('jane@example.com')).toBe('jane@example.com');
    });
  });

  describe('extractRecipientsFromEntities', () => {
    it('prioritizes designated signatory contact when contactRole = "signatory" (FM-CRM-02)', () => {
      const options: CrmRecipientExtractionOptions = {
        contactRole: 'signatory',
        templateVariables: ['entity_name', 'name', 'email'],
      };

      const result = extractRecipientsFromEntities([mockEntities[0]], options);
      expect(result.totalRows).toBe(1);
      expect(result.validRows).toBe(1);

      const recipient = result.previewSample[0];
      // Should pick Alice Signer because isSignatory === true
      expect(recipient.recipientName).toBe('Alice Signer');
      expect(recipient.recipientEmail).toBe('alice@acme.com');
      expect(recipient.contactId).toBe('cnt-02');
      expect(recipient.entityId).toBe('ent-001');
      expect(recipient.sourceType).toBe('crm');
      expect(recipient.mappedVariables.entity_name).toBe('Acme Global Corp');
    });

    it('prioritizes primary contact when contactRole = "primary"', () => {
      const options: CrmRecipientExtractionOptions = {
        contactRole: 'primary',
        templateVariables: ['entity_name', 'name', 'email'],
      };

      const result = extractRecipientsFromEntities([mockEntities[0]], options);
      const recipient = result.previewSample[0];
      // Should pick John Doe because isPrimary === true
      expect(recipient.recipientName).toBe('John Doe');
      expect(recipient.recipientEmail).toBe('john@acme.com');
      expect(recipient.contactId).toBe('cnt-01');
    });

    it('expands into multiple recipients when contactRole = "all"', () => {
      const options: CrmRecipientExtractionOptions = {
        contactRole: 'all',
        templateVariables: ['entity_name', 'name', 'email'],
      };

      const result = extractRecipientsFromEntities([mockEntities[0]], options);
      expect(result.totalRows).toBe(2);
      expect(result.previewSample.map((r) => r.recipientEmail)).toEqual([
        'john@acme.com',
        'alice@acme.com',
      ]);
    });

    it('falls back to entity root when entityContacts is empty but primaryEmail exists (FM-CRM-01)', () => {
      const options: CrmRecipientExtractionOptions = {
        contactRole: 'signatory',
        templateVariables: ['entity_name'],
      };

      const result = extractRecipientsFromEntities([mockEntities[1]], options);
      expect(result.totalRows).toBe(1);
      expect(result.validRows).toBe(1);

      const recipient = result.previewSample[0];
      expect(recipient.recipientName).toBe('Sarah Connor');
      expect(recipient.recipientEmail).toBe('sarah@cyberdyne.com');
      expect(recipient.entityId).toBe('ent-002');
      expect(recipient.isValid).toBe(true);
    });

    it('flags row as invalid when entity has no contact email anywhere', () => {
      const options: CrmRecipientExtractionOptions = {
        contactRole: 'signatory',
        templateVariables: ['entity_name'],
      };

      const result = extractRecipientsFromEntities([mockEntities[2]], options);
      expect(result.totalRows).toBe(1);
      expect(result.invalidRows).toBe(1);

      const recipient = result.previewSample[0];
      expect(recipient.isValid).toBe(false);
      expect(recipient.errors).toContain('Entity lacks a valid contact email address.');
    });

    it('detects missing template variables and flags missingVariables (FM-P9-04)', () => {
      const options: CrmRecipientExtractionOptions = {
        contactRole: 'signatory',
        templateVariables: ['entity_name', 'custom_contract_code'],
      };

      const result = extractRecipientsFromEntities([mockEntities[0]], options);
      const recipient = result.previewSample[0];
      expect(recipient.missingVariables).toContain('custom_contract_code');
      expect(recipient.errors).toContain('Missing mandatory template variable: custom_contract_code');
      expect(recipient.isValid).toBe(false);
    });
  });
});
