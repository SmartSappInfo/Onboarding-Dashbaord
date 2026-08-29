import { describe, it, expect } from 'vitest';
import { IdentityMergeService } from '../identity/IdentityMergeService';
import type { Prospect, MergeFieldSelection } from '../types';
import type { WorkspaceEntity } from '@/lib/types';

describe('IdentityMergeService', () => {
  const mockProspect: Prospect = {
    id: 'pros_ridge_123',
    workspaceId: 'ws_test',
    organizationId: 'org_test',
    name: 'Ridge International School Ghana',
    domain: 'ridgeinternationalschool.edu.gh',
    phone: '+233244112233',
    address: 'Ridge, Kumasi, Ghana',
    industry: 'Education',
    source: 'google_places',
    scoring: {
      overallScore: 88,
      needScore: 90,
      digitalMaturity: 45,
      buyingIntent: 85,
      budgetProbability: 80,
      decisionMakerFound: 90,
      engagement: 75
    },
    websiteScan: {
      technologies: ['WordPress', 'WooCommerce', 'Paystack'],
      sslValid: true,
      hasFacebook: false,
      hasInstagram: false,
      hasLinkedIn: false,
      hasTwitter: false,
      scannedAt: '2026-08-29T00:00:00.000Z'
    },
    contacts: [
      {
        name: 'Dr. Kwame Mensah',
        email: 'kmensah@ridge.edu.gh',
        phone: '+233244112233',
        role: 'Head of School',
        confidence: 0.95,
        verificationStatus: 'verified'
      },
      {
        name: 'Adwoa Osei',
        email: 'finance@ridge.edu.gh',
        phone: '+233244998877',
        role: 'Bursar',
        confidence: 0.85,
        verificationStatus: 'unverified'
      }
    ],
    syncStatus: 'unregistered',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z'
  };

  const mockCrmEntity: WorkspaceEntity = {
    id: 'ws_test_entity_456',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    entityId: 'entity_456',
    entityType: 'institution',
    status: 'active',
    displayName: 'Ridge Int. School',
    primaryEmail: 'info@ridge.edu.gh',
    primaryPhone: '+233322011223',
    locationString: 'Kumasi Metropolitan, Ashanti Region',
    workspaceTags: ['vip-client', 'kumasi-schools'],
    entityContacts: [
      {
        id: 'crm_c_1',
        name: 'Dr. Kwame Mensah',
        email: 'kmensah@ridge.edu.gh', // Duplicate email match with prospect
        phone: '+233244112233',
        typeKey: 'principal',
        typeLabel: 'Principal',
        isPrimary: true,
        isSignatory: true,
        order: 1
      },
      {
        id: 'crm_c_2',
        name: 'Kofi Owusu',
        email: 'admin@ridge.edu.gh',
        typeKey: 'registrar',
        typeLabel: 'Registrar',
        isPrimary: false,
        isSignatory: false,
        order: 2
      }
    ],
    customData: {
      curriculum: 'British & Ghanaian',
      technologies: ['WordPress', 'Google Workspace']
    },
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };

  it('computes smart default field selections', () => {
    const defaults = IdentityMergeService.getDefaultMergeSelection(mockProspect, mockCrmEntity);

    expect(defaults.nameChoice).toBe('record_b'); // Prioritize existing CRM entity name
    expect(defaults.contactsStrategy).toBe('combine');
    expect(defaults.technologiesStrategy).toBe('combine');
  });

  it('synthesizes canonical record and deduplicates contacts sharing identical emails', () => {
    const selection: MergeFieldSelection = {
      nameChoice: 'record_a', // User chooses prospect's fuller name
      domainChoice: 'record_a',
      phoneChoice: 'record_b',
      addressChoice: 'record_b',
      technologiesStrategy: 'combine',
      contactsStrategy: 'combine'
    };

    const canonical = IdentityMergeService.synthesizeCanonicalRecord(
      mockProspect,
      mockCrmEntity,
      selection
    );

    // Verify Display Name
    expect(canonical.displayName).toBe('Ridge International School Ghana');

    // Verify Contacts Deduplication: Dr. Kwame Mensah should not appear twice!
    // Total should be: Dr. Kwame Mensah (CRM) + Kofi Owusu (CRM) + Adwoa Osei (Prospect) = 3 contacts
    expect(canonical.mergedContacts.length).toBe(3);
    const emails = canonical.mergedContacts.map(c => c.email?.toLowerCase());
    expect(emails).toContain('kmensah@ridge.edu.gh');
    expect(emails).toContain('admin@ridge.edu.gh');
    expect(emails).toContain('finance@ridge.edu.gh');

    // Verify Technologies union
    expect(canonical.technologies).toContain('WordPress');
    expect(canonical.technologies).toContain('WooCommerce');
    expect(canonical.technologies).toContain('Paystack');
    expect(canonical.technologies).toContain('Google Workspace');

    // Verify Tags
    expect(canonical.workspaceTags).toContain('vip-client');
    expect(canonical.workspaceTags).toContain('lead-intelligence-merged');
    expect(canonical.workspaceTags).toContain('source:google_places');
  });

  it('respects custom override inputs for name and domain', () => {
    const selection: MergeFieldSelection = {
      nameChoice: 'custom',
      customName: 'Ridge International Academy (Consolidated)',
      domainChoice: 'custom',
      customDomain: 'https://www.ridge-academy.org/portal',
      phoneChoice: 'record_b',
      addressChoice: 'record_b',
      technologiesStrategy: 'record_b_only',
      contactsStrategy: 'record_b_only'
    };

    const canonical = IdentityMergeService.synthesizeCanonicalRecord(
      mockProspect,
      mockCrmEntity,
      selection
    );

    expect(canonical.displayName).toBe('Ridge International Academy (Consolidated)');
    expect(canonical.domain).toBe('ridge-academy.org'); // canonicalized
    expect(canonical.mergedContacts.length).toBe(2); // Only CRM contacts
  });
});
